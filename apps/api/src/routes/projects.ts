import type { FastifyInstance } from "fastify";
import { authenticate, requireUser } from "../lib/auth.js";
import { store } from "../lib/store.js";
import { auditLog } from "../lib/audit.js";
import { getStorage } from "../lib/storage.js";
import { projectIdentitySchema, uuidParam, zodMessage } from "../lib/validate.js";

export async function projectRoutes(app: FastifyInstance) {
  // Every route here is authenticated and scoped to the caller (never trust a client-supplied owner).
  app.addHook("preHandler", authenticate);

  app.get("/projects", async (req) => {
    const user = requireUser(req);
    return store.listProjects(user.id);
  });

  // Idempotent on (userId, canonicalRemote).
  app.post("/projects", async (req, reply) => {
    const user = requireUser(req);
    const parsed = projectIdentitySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });

    const existing = await store.findProjectByCanonical(user.id, parsed.data.canonicalRemote);
    if (existing) return existing;
    const proj = await store.createProject({ userId: user.id, ...parsed.data });
    await auditLog(req, "project.create", { projectId: proj.id });
    reply.status(201);
    return proj;
  });

  app.get("/projects/:id", async (req, reply) => {
    const user = requireUser(req);
    const p = uuidParam.safeParse(req.params);
    const proj = p.success ? await store.getProjectById(user.id, p.data.id) : null;
    if (!proj) return reply.status(404).send({ error: "Project not found" });
    return proj;
  });

  app.delete("/projects/:id", async (req, reply) => {
    const user = requireUser(req);
    const p = uuidParam.safeParse(req.params);
    const keys = p.success ? await store.deleteProject(user.id, p.data.id) : null;
    if (!keys) return reply.status(404).send({ error: "Project not found" });
    // Purge ciphertext objects too — deleting a project means the data is gone.
    const storage = getStorage();
    await Promise.allSettled(keys.map((k) => storage.deleteObject(k)));
    await auditLog(req, "project.delete");
    return { ok: true, purgedObjects: keys.length };
  });
}
