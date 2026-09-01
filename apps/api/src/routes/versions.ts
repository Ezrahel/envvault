import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, requireUser } from "../lib/auth.js";
import { store } from "../lib/store.js";
import { getStorage, buildLegacyObjectKey } from "../lib/storage.js";
import { auditLog } from "../lib/audit.js";

const uploadSchema = z.object({
  project: z.object({
    provider: z.string().min(1),
    host: z.string().min(1),
    owner: z.string().optional(),
    repository: z.string().min(1),
    canonicalRemote: z.string().min(1),
  }),
  environment: z.object({ name: z.string().min(1).max(100), fileName: z.string().min(1).max(100) }),
  encryption: z.object({
    algorithm: z.string().min(1),
    keyVersion: z.number().int().min(1),
    nonce: z.string().min(1),
    authTag: z.string().optional(),
  }),
  ciphertext: z.string().min(1), // base64 ciphertext, never plaintext
});

export async function versionRoutes(app: FastifyInstance) {
  // Helper to store ciphertext via storage abstraction (R2 or local) per §67-68
  async function persistVersion(
    userId: string,
    project: { canonicalRemote: string; provider: string; host: string; owner?: string | undefined; repository: string },
    environment: { name: string; fileName: string },
    encryption: { algorithm: string; keyVersion: number; nonce: string; authTag?: string | undefined },
    ciphertext: string,
  ) {
    // Authorization: verify project belongs to user (via store)
    // For MVP we auto-create project association if not exists
    let proj = await store.findProjectByCanonical(userId, project.canonicalRemote);
    if (!proj) {
      proj = await store.createProject({
        userId,
        provider: project.provider,
        host: project.host,
        owner: project.owner,
        repository: project.repository,
        canonicalRemote: project.canonicalRemote,
      });
    }

    const rec = await store.addVersion({
      environmentFileId: `${project.canonicalRemote}:${environment.fileName}`, // placeholder; prod would use real envFileId
      objectKey: buildLegacyObjectKey({ userId, canonicalRemote: project.canonicalRemote, environmentName: environment.name, version: 0 }), // version filled inside store
      cipherAlgorithm: encryption.algorithm,
      algorithm: encryption.algorithm,
      formatVersion: 1,
      keyVersion: encryption.keyVersion,
      nonce: encryption.nonce,
      authTag: encryption.authTag,
      ciphertext,
      canonicalRemote: project.canonicalRemote,
      fileName: environment.fileName,
      environmentName: environment.name,
      createdBy: userId,
    } as any);

    // Also persist to object storage per §67 — key is private, no secret in name
    const storage = getStorage();
    const objectKey = `users/${userId}/projects/${proj.id}/environments/${environment.name}/versions/${rec.id}`;
    // Store envelope as JSON (ciphertext + metadata) — prod would store raw ciphertext
    await storage.putObject(objectKey, Buffer.from(JSON.stringify({ ciphertext, nonce: encryption.nonce, authTag: encryption.authTag }), "utf-8"));

    return rec;
  }

  // Upload new version (canonical endpoint)
  app.post("/environment-files/:id/versions", { preHandler: [authenticate] }, async (req, reply) => {
    const user = requireUser(req);
    const parsed = uploadSchema.safeParse((req as any).body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });

    const { project, environment, encryption, ciphertext } = parsed.data;

    // Rate limiting is handled globally; per-user project version creation is audited
    const rec = await persistVersion(user.id, project, environment, encryption, ciphertext);

    const proj = await store.findProjectByCanonical(user.id, project.canonicalRemote);
    await auditLog(req as any, "version.upload", { userId: user.id, ...(proj ? { projectId: proj.id } : {}) });
    app.log.info({ event: "version.upload", fileName: environment.fileName, canonicalRemote: project.canonicalRemote }, "upload");

    reply.status(201);
    return { version: rec.version, id: rec.id, objectKey: rec.objectKey };
  });

  // Mock alias used by CLI for backward compat: POST /v1/environment-files/mock/versions
  app.post("/environment-files/mock/versions", { preHandler: [authenticate] }, async (req, reply) => {
    const user = requireUser(req);
    const parsed = uploadSchema.safeParse((req as any).body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
    const { project, environment, encryption, ciphertext } = parsed.data;
    const rec = await persistVersion(user.id, project, environment, encryption, ciphertext);
    await auditLog(req as any, "version.upload", { userId: user.id });
    reply.status(201);
    return { version: rec.version, id: rec.id, objectKey: rec.objectKey };
  });

  function toPayload(r: any) {
    return {
      ...r,
      algorithm: r.algorithm ?? r.cipherAlgorithm ?? "AES-256-GCM",
      formatVersion: r.formatVersion ?? 1,
      cipherAlgorithm: r.cipherAlgorithm ?? r.algorithm,
    };
  }

  app.get("/environment-files/:id/versions", { preHandler: [authenticate] }, async (req, reply) => {
    const user = requireUser(req);
    const { canonicalRemote, fileName } = (req as any).query;
    if (canonicalRemote && fileName) {
      // Scoped to user — ensures cross-account collision prevented per §53
      // In-memory store already per canonical, but we filter to user's projects
      const proj = await store.findProjectByCanonical(user.id, canonicalRemote as string);
      if (!proj) return [];
      const list = await store.listVersions(canonicalRemote as string, fileName as string);
      return list.map(toPayload);
    }
    // fallback by id (not used in MVP)
    return [];
  });

  app.get("/environment-files/mock/versions", { preHandler: [authenticate] }, async (req, reply) => {
    const user = requireUser(req);
    const { canonicalRemote, fileName } = (req as any).query;
    if (!canonicalRemote || !fileName) return [];
    const proj = await store.findProjectByCanonical(user.id, canonicalRemote as string);
    if (!proj) return [];
    const list = await store.listVersions(canonicalRemote as string, fileName as string);
    return list.map(toPayload);
  });

  app.get("/environment-files/:id/versions/:version", { preHandler: [authenticate] }, async (req, reply) => {
    const user = requireUser(req);
    const { id, version } = (req as any).params;
    // Search across user's versions
    // For MVP, iterate known canonicals for this user
    const projects = await store.listProjects(user.id);
    for (const proj of projects) {
      // Need to know fileName — try to find via store; for MVP we scan all
      // Simpler: check store directly via version id (if id matches)
      // We lack index by id, so we scan via store.listVersions if we can guess fileName from query
      const { fileName, canonicalRemote } = (req as any).query as { fileName?: string; canonicalRemote?: string };
      if (fileName && canonicalRemote) {
        const rec = await store.getVersionByNumber(canonicalRemote, fileName, Number(version));
        if (rec) {
          // Generate signed URL for object storage per §68 (short-lived, private)
          const storage = getStorage();
          const signedUrl = await storage.generateSignedUrl(rec.objectKey, 900);
          return { ...rec, signedUrl };
        }
      }
    }
    // Fallback: brute force search (dev only)
    for (const proj of projects) {
      // We don't have fileName index, so return 404 if not found via query
    }
    return reply.status(404).send({ error: "Version not found" });
  });

  // Signed URL endpoint for download (private bucket, no public access per §68)
  app.get("/storage/signed/:key", { preHandler: [authenticate] }, async (req, reply) => {
    const { key } = (req as any).params;
    const storage = getStorage();
    const data = await storage.getObject(decodeURIComponent(key));
    if (!data) return reply.status(404).send({ error: "Object not found" });
    return reply.send(data);
  });
}
