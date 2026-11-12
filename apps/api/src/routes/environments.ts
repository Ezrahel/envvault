import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, requireUser } from "../lib/auth.js";
import { store } from "../lib/store.js";
import { auditLog } from "../lib/audit.js";
import { envNameSchema, fileNameSchema, uuidParam, zodMessage } from "../lib/validate.js";

export async function environmentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  /** Resolve an environment the caller owns (via its project), or null. */
  async function ownedEnvironment(userId: string, params: unknown) {
    const p = uuidParam.safeParse(params);
    if (!p.success) return null;
    const env = await store.getEnvironment(p.data.id);
    if (!env) return null;
    const proj = await store.getProjectById(userId, env.projectId);
    return proj ? env : null;
  }

  app.get("/projects/:id/environments", async (req, reply) => {
    const user = requireUser(req);
    const p = uuidParam.safeParse(req.params);
    const proj = p.success ? await store.getProjectById(user.id, p.data.id) : null;
    if (!proj) return reply.status(404).send({ error: "Project not found" });
    return store.listEnvironments(proj.id);
  });

  app.post("/projects/:id/environments", async (req, reply) => {
    const user = requireUser(req);
    const p = uuidParam.safeParse(req.params);
    const proj = p.success ? await store.getProjectById(user.id, p.data.id) : null;
    if (!proj) return reply.status(404).send({ error: "Project not found" });
    const parsed = z.object({ name: envNameSchema }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const env = await store.createEnvironment(proj.id, parsed.data.name, user.id);
    await auditLog(req, "environment.create", { projectId: proj.id });
    reply.status(201);
    return env;
  });

  // 404 (not 403) for other users' resources: don't confirm that an id exists.
  app.get("/environments/:id/files", async (req, reply) => {
    const user = requireUser(req);
    const env = await ownedEnvironment(user.id, req.params);
    if (!env) return reply.status(404).send({ error: "Environment not found" });
    return store.listEnvFiles(env.id);
  });

  app.post("/environments/:id/files", async (req, reply) => {
    const user = requireUser(req);
    const env = await ownedEnvironment(user.id, req.params);
    if (!env) return reply.status(404).send({ error: "Environment not found" });
    const parsed = z.object({ fileName: fileNameSchema }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const file = await store.createEnvFile(env.id, parsed.data.fileName);
    await auditLog(req, "environment_file.create", { projectId: env.projectId });
    reply.status(201);
    return file;
  });
}
