import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, requireUser } from "../lib/auth.js";
import { store } from "../lib/store.js";
import { auditLog } from "../lib/audit.js";

const createProjectSchema = z.object({
  provider: z.string().min(1),
  host: z.string().min(1),
  owner: z.string().optional(),
  repository: z.string().min(1),
  canonicalRemote: z.string().min(1),
});

export async function projectRoutes(app: FastifyInstance) {
  // List projects — scoped to authenticated user per §69 (never trust client projectId)
  app.get("/projects", { preHandler: [authenticate] }, async (req) => {
    const user = requireUser(req);
    return store.listProjects(user.id);
  });

  // Create project — idempotent on (userId, canonicalRemote) per §31 unique constraint
  app.post("/projects", { preHandler: [authenticate] }, async (req, reply) => {
    const user = requireUser(req);
    const parsed = createProjectSchema.safeParse((req as any).body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });

    const existing = await store.findProjectByCanonical(user.id, parsed.data.canonicalRemote);
    if (existing) return existing;

    const proj = await store.createProject({
      userId: user.id,
      provider: parsed.data.provider,
      host: parsed.data.host,
      owner: parsed.data.owner,
      repository: parsed.data.repository,
      canonicalRemote: parsed.data.canonicalRemote,
    });

    await auditLog(req as any, "project.create", { userId: user.id, projectId: proj.id });
    app.log.info({ event: "project.create", projectId: proj.id, userId: user.id }, "project created");
    reply.status(201);
    return proj;
  });

  app.get("/projects/:id", { preHandler: [authenticate] }, async (req, reply) => {
    const user = requireUser(req);
    const { id } = (req as any).params;
    const proj = await store.getProjectById(user.id, id);
    if (!proj) return reply.status(404).send({ error: "Project not found" });
    return proj;
  });

  app.delete("/projects/:id", { preHandler: [authenticate] }, async (req, reply) => {
    const user = requireUser(req);
    const { id } = (req as any).params;
    const ok = await store.deleteProject(user.id, id);
    if (!ok) return reply.status(404).send({ error: "Project not found" });
    await auditLog(req as any, "project.delete", { userId: user.id, projectId: id });
    app.log.info({ event: "project.delete", projectId: id, userId: user.id }, "project deleted");
    return { ok: true };
  });
}
