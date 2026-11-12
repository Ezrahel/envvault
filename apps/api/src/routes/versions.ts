import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticate, requireUser } from "../lib/auth.js";
import { store, type SecretVersionRecord } from "../lib/store.js";
import { getStorage, buildObjectKey, isOwnedKey } from "../lib/storage.js";
import { auditLog } from "../lib/audit.js";
import {
  base64Schema,
  canonicalRemoteSchema,
  envNameSchema,
  fileNameSchema,
  MAX_CIPHERTEXT_B64,
  projectIdentitySchema,
  zodMessage,
} from "../lib/validate.js";

const uploadSchema = z.object({
  project: projectIdentitySchema,
  environment: z.object({ name: envNameSchema, fileName: fileNameSchema }),
  encryption: z.object({
    algorithm: z.literal("AES-256-GCM"),
    keyVersion: z.number().int().min(1).max(1_000_000),
    nonce: base64Schema(64),
    authTag: base64Schema(64).optional(),
    formatVersion: z.number().int().min(1).max(100).optional(),
  }),
  ciphertext: base64Schema(MAX_CIPHERTEXT_B64), // encrypted blob only — never plaintext
});

const listQuery = z.object({ canonicalRemote: canonicalRemoteSchema, fileName: fileNameSchema });

/** Public shape of a version (what the CLI consumes). Internal ids/keys are not exposed. */
function toPayload(r: SecretVersionRecord) {
  return {
    id: r.id,
    version: r.version,
    formatVersion: r.formatVersion ?? 1,
    algorithm: r.cipherAlgorithm,
    cipherAlgorithm: r.cipherAlgorithm,
    keyVersion: r.keyVersion,
    nonce: r.nonce,
    authTag: r.authTag,
    ciphertext: r.ciphertext,
    canonicalRemote: r.canonicalRemote,
    fileName: r.fileName,
    environmentName: r.environmentName,
    createdAt: r.createdAt,
  };
}

export async function versionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  async function upload(req: FastifyRequest, reply: FastifyReply) {
    const user = requireUser(req);
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const { project, environment, encryption, ciphertext } = parsed.data;

    // Resolve-or-create the caller's own project for this remote.
    const proj = await store.createProject({ userId: user.id, ...project });

    // Write the object first, then the row: a storage failure can't leave a
    // version row pointing at nothing. If the row insert fails we clean up.
    const id = randomUUID();
    const objectKey = buildObjectKey({ userId: user.id, projectId: proj.id, environmentName: environment.name, versionId: id });
    const storage = getStorage();
    await storage.putObject(
      objectKey,
      Buffer.from(
        JSON.stringify({
          formatVersion: encryption.formatVersion ?? 1,
          algorithm: encryption.algorithm,
          keyVersion: encryption.keyVersion,
          nonce: encryption.nonce,
          authTag: encryption.authTag,
          ciphertext,
        }),
        "utf-8",
      ),
    );

    let rec: SecretVersionRecord;
    try {
      rec = await store.addVersion({
        id,
        userId: user.id,
        projectId: proj.id,
        environmentName: environment.name,
        fileName: environment.fileName,
        objectKey,
        cipherAlgorithm: encryption.algorithm,
        formatVersion: encryption.formatVersion ?? 1,
        keyVersion: encryption.keyVersion,
        nonce: encryption.nonce,
        authTag: encryption.authTag,
        ciphertext,
      });
    } catch (e) {
      await storage.deleteObject(objectKey).catch(() => {});
      throw e;
    }

    await auditLog(req, "version.upload", { projectId: proj.id });
    reply.status(201);
    return { version: rec.version, id: rec.id, projectId: proj.id };
  }

  async function list(req: FastifyRequest, reply: FastifyReply) {
    const user = requireUser(req);
    const q = listQuery.safeParse(req.query);
    if (!q.success) return reply.status(400).send({ error: zodMessage(q.error) });
    const rows = await store.listVersions(user.id, q.data.canonicalRemote, q.data.fileName);
    return rows.map(toPayload);
  }

  // Canonical endpoints. `:id` is accepted for forward compatibility; scoping
  // is always (caller, canonicalRemote, fileName).
  app.post("/environment-files/:id/versions", upload);
  app.get("/environment-files/:id/versions", list);
  // The shipped CLI calls /environment-files/mock/versions — `mock` simply binds to `:id`.

  app.get("/environment-files/:id/versions/:version", async (req, reply) => {
    const user = requireUser(req);
    const q = listQuery.safeParse(req.query);
    const v = z.coerce.number().int().min(1).safeParse((req.params as { version?: string }).version);
    if (!q.success || !v.success) return reply.status(400).send({ error: "canonicalRemote, fileName and a numeric version are required" });
    const rec = await store.getVersionByNumber(user.id, q.data.canonicalRemote, q.data.fileName, v.data);
    if (!rec) return reply.status(404).send({ error: "Version not found" });
    const signedUrl = await getStorage().generateSignedUrl(rec.objectKey, 900);
    return { ...toPayload(rec), signedUrl };
  });

  // Direct object fetch (local-storage mode). Only the caller's own prefix is readable.
  app.get("/storage/signed/:key", async (req, reply) => {
    const user = requireUser(req);
    const raw = (req.params as { key?: string }).key ?? "";
    let key: string;
    try {
      key = decodeURIComponent(raw);
    } catch {
      return reply.status(400).send({ error: "Invalid key" });
    }
    if (!isOwnedKey(key, user.id)) return reply.status(404).send({ error: "Object not found" });
    const data = await getStorage().getObject(key);
    if (!data) return reply.status(404).send({ error: "Object not found" });
    reply.header("Cache-Control", "no-store").type("application/json");
    return reply.send(data);
  });
}
