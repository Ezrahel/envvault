import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, requireUser } from "../lib/auth.js";
import { store } from "../lib/store.js";
import { auditLog } from "../lib/audit.js";

export async function environmentRoutes(app: FastifyInstance) {
  app.get("/projects/:id/environments", { preHandler: [authenticate] }, async (req, reply) => {
    const user = requireUser(req);
    const { id } = (req as any).params;
    // Authorization: verify project belongs to user
    const proj = await store.getProjectById(user.id, id);
    if (!proj) return reply.status(404).send({ error: "Project not found" });
    return store.listEnvironments(id);
  });

  app.post("/projects/:id/environments", { preHandler: [authenticate] }, async (req, reply) => {
    const user = requireUser(req);
    const { id } = (req as any).params;
    const proj = await store.getProjectById(user.id, id);
    if (!proj) return reply.status(404).send({ error: "Project not found" });
    const schema = z.object({ name: z.string().min(1).max(100) });
    const parsed = schema.safeParse((req as any).body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });

    const env = await store.createEnvironment(id, parsed.data.name, user.id);
    await auditLog(req as any, "environment.create", { userId: user.id, projectId: id });
    reply.status(201);
    return env;
  });

  app.get("/environments/:id/files", { preHandler: [authenticate] }, async (req, reply) => {
    const user = requireUser(req);
    const { id } = (req as any).params;
    const env = await store.getEnvironment(id);
    if (!env) return reply.status(404).send({ error: "Environment not found" });
    const proj = await store.getProjectById(user.id, env.projectId);
    if (!proj) return reply.status(403).send({ error: "Forbidden" });
    return store.listEnvFiles(id);
  });

  app.post("/environments/:id/files", { preHandler: [authenticate] }, async (req, reply) => {
    const user = requireUser(req);
    const { id } = (req as any).params;
    const env = await store.getEnvironment(id);
    if (!env) return reply.status(404).send({ error: "Environment not found" });
    const proj = await store.getProjectById(user.id, env.projectId);
    if (!proj) return reply.status(403).send({ error: "Forbidden" });
    const schema = z.object({ fileName: z.string().min(1).max(100) });
    const parsed = schema.safeParse((req as any).body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
    const file = await store.createEnvFile(id, parsed.data.fileName);
    await auditLog(req as any, "environment_file.create", { userId: user.id, projectId: env.projectId });
    reply.status(201);
    return file;
  });
}
