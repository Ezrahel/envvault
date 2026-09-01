import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { store } from "../lib/store.js";
import { auditLog } from "../lib/audit.js";

const loginSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  deviceName: z.string().optional(),
  platform: z.string().optional(),
});

const githubSchema = z.object({
  email: z.string().email(),
  githubUser: z.string().min(1),
  provider: z.literal("github").optional(),
  deviceName: z.string().optional(),
  platform: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", async (req, reply) => {
    const body = loginSchema.safeParse((req as any).body);
    if (!body.success) return reply.status(400).send({ error: body.error.message });
    const { email, name, deviceName, platform } = body.data;

    const { user, token } = await store.upsertUser(email);
    // Device registration per §31 devices table
    if (deviceName) {
      await store.registerDevice(user.id, deviceName, platform ?? (req.headers["user-agent"] as string) ?? "unknown");
    }

    await auditLog(req as any, "auth.login", { userId: user.id });
    app.log.info({ event: "auth.login", email, userId: user.id }, "login");
    return { token, userId: user.id, email, name: name ?? user.email };
  });

  // GitHub OAuth per spec §51 — least privilege, repository identity verification
  app.post("/github", async (req, reply) => {
    const body = githubSchema.safeParse((req as any).body);
    if (!body.success) return reply.status(400).send({ error: body.error.message });
    const { email, githubUser, deviceName, platform } = body.data;

    // In production, verify GitHub OAuth code via https://github.com/login/oauth/access_token
    // and fetch user via GitHub API to confirm githubUser matches. For MVP, mock.
    if (!/^[a-zA-Z0-9-]+$/.test(githubUser)) {
      return reply.status(400).send({ error: "Invalid GitHub username" });
    }

    const { user, token } = await store.upsertUser(email);
    // Store GitHub association as audit metadata (future: providerRepositoryId)
    await auditLog(req as any, "auth.github_login", { userId: user.id });
    app.log.info({ event: "auth.github_login", email, githubUser, userId: user.id }, "github login");

    if (deviceName) {
      await store.registerDevice(user.id, deviceName, platform ?? "github-oauth");
    }

    return { token, userId: user.id, email, githubUser, provider: "github" };
  });

  // OAuth callback placeholder for browser flow (spec §51 GitHub integration)
  app.get("/github/callback", async (req, reply) => {
    const { code, state } = (req as any).query as { code?: string; state?: string };
    if (!code) return reply.status(400).send({ error: "Missing OAuth code. In production, redirect to GitHub OAuth." });
    // Mock: exchange code for token
    return { message: "GitHub OAuth callback received (MVP mock). Use POST /v1/auth/github with email and githubUser.", code, state };
  });

  app.post("/logout", async (req, reply) => {
    const auth = req.headers.authorization;
    if (auth) {
      const token = auth.slice(7);
      await store.revokeToken(token);
      await auditLog(req as any, "auth.logout");
    }
    return { ok: true };
  });

  app.post("/refresh", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.status(401).send({ error: "No token" });
    const token = auth.slice(7);
    const newToken = await store.rotateToken(token);
    if (!newToken) return reply.status(401).send({ error: "Invalid token" });
    return { token: newToken };
  });

  app.get("/me", async (req, reply) => {
    const h = req.headers.authorization;
    if (!h) return reply.status(401).send({ error: "Unauthorized" });
    const token = h.slice(7);
    const user = await store.getUserByToken(token);
    if (!user) return reply.status(401).send({ error: "Invalid token" });
    return { userId: user.id, email: user.email };
  });

  // Device management per spec §31
  app.get("/devices", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.status(401).send({ error: "Unauthorized" });
    const token = auth.slice(7);
    const user = await store.getUserByToken(token);
    if (!user) return reply.status(401).send({ error: "Invalid token" });
    return store.listDevices(user.id);
  });

  app.delete("/devices/:id", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.status(401).send({ error: "Unauthorized" });
    const token = auth.slice(7);
    const user = await store.getUserByToken(token);
    if (!user) return reply.status(401).send({ error: "Invalid token" });
    const { id } = (req as any).params;
    await store.revokeDevice(id);
    await auditLog(req as any, "device.revoke", { userId: user.id, deviceId: id });
    return { ok: true };
  });
}
