import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { store } from "../lib/store.js";
import { auditLog } from "../lib/audit.js";
import { signJwt, verifyJwt } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().optional(),
  deviceName: z.string().optional(),
  platform: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  // Optional for backward compat (older CLI + existing tests send email only).
  // Required in production for accounts that have a password set.
  password: z.string().min(1).max(128).optional(),
  name: z.string().optional(),
  deviceName: z.string().optional(),
  platform: z.string().optional(),
});

const githubSchema = z.object({
  email: z.string().email().optional(),
  githubUser: z.string().min(1).optional(),
  provider: z.literal("github").optional(),
  deviceName: z.string().optional(),
  platform: z.string().optional(),
  // Real OAuth: frontend/CLI exchanges via GitHub then sends the code.
  code: z.string().min(1).optional(),
});

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function issuePair(user: { id: string; email: string }) {
  const token = signJwt({ sub: user.id, email: user.email, type: "access" });
  const refreshToken = signJwt({ sub: user.id, email: user.email, type: "refresh" });
  return { token, refreshToken };
}

export async function authRoutes(app: FastifyInstance) {
  // Register — the production path. Creates the account with a scrypt-hashed password.
  app.post("/register", async (req, reply) => {
    const body = registerSchema.safeParse((req as any).body);
    if (!body.success) return reply.status(400).send({ error: body.error.message });
    const { email, password, name, deviceName, platform } = body.data;

    const existing = await store.getUserByEmail(email);
    if (existing?.passwordHash) {
      return reply.status(409).send({ error: "Account already exists. Log in instead." });
    }
    const user = await store.ensureUser(email, name);
    await store.setPasswordHash(user.id, hashPassword(password));
    if (deviceName) {
      await store.registerDevice(user.id, deviceName, platform ?? (req.headers["user-agent"] as string) ?? "unknown");
    }
    const pair = issuePair(user);
    await auditLog(req as any, "auth.register", { userId: user.id });
    app.log.info({ event: "auth.register", userId: user.id }, "register");
    reply.status(201);
    return { ...pair, userId: user.id, email: user.email };
  });

  app.post("/login", async (req, reply) => {
    const body = loginSchema.safeParse((req as any).body);
    if (!body.success) return reply.status(400).send({ error: body.error.message });
    const { email, password, name, deviceName, platform } = body.data;

    let user = await store.getUserByEmail(email);
    if (!user) {
      if (isProd()) {
        return reply.status(401).send({ error: "Account not found. Register first." });
      }
      // Dev/test: preserve legacy auto-provisioning (existing tests + frictionless onboarding).
      user = await store.ensureUser(email, name);
    } else if (name && !user.name) {
      user = await store.ensureUser(email, name);
    }

    if (user.passwordHash) {
      if (!password || !verifyPassword(password, user.passwordHash)) {
        return reply.status(401).send({ error: "Invalid email or password" });
      }
    } else if (password) {
      // Upgrade path: set a password on a legacy passwordless account.
      await store.setPasswordHash(user.id, hashPassword(password));
    } else if (isProd()) {
      return reply.status(401).send({ error: "Password required. Set one via login with a password once, or register." });
    }

    // Device registration per §31 devices table
    if (deviceName) {
      await store.registerDevice(user.id, deviceName, platform ?? (req.headers["user-agent"] as string) ?? "unknown");
    }

    const pair = issuePair(user);
    await auditLog(req as any, "auth.login", { userId: user.id });
    app.log.info({ event: "auth.login", userId: user.id }, "login");
    return { ...pair, userId: user.id, email: user.email, name: name ?? user.name ?? user.email };
  });

  // GitHub OAuth per spec §51 — least privilege, repository identity verification.
  // Real flow (when GITHUB_CLIENT_ID/SECRET are set and a `code` is provided):
  //   code → github.com/login/oauth/access_token → api.github.com/user (verified login + id).
  // Dev/MVP fallback (no secrets): email + githubUser mock, as before.
  app.post("/github", async (req, reply) => {
    const body = githubSchema.safeParse((req as any).body);
    if (!body.success) return reply.status(400).send({ error: body.error.message });
    const { email, githubUser, deviceName, platform, code } = body.data;

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (code && clientId && clientSecret) {
      try {
        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
        });
        if (!tokenRes.ok) return reply.status(502).send({ error: "GitHub token exchange failed" });
        const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
        if (!tokenData.access_token) {
          return reply.status(502).send({ error: `GitHub token exchange failed: ${tokenData.error ?? "unknown"}` });
        }
        const userRes = await fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "envvault" },
        });
        if (!userRes.ok) return reply.status(502).send({ error: "GitHub user fetch failed" });
        const gh = (await userRes.json()) as { login: string; id: number; email?: string | null };
        if (!/^[a-zA-Z0-9-]+$/.test(gh.login)) {
          return reply.status(502).send({ error: "Invalid GitHub username" });
        }
        const resolvedEmail = email ?? gh.email ?? `${gh.login}@users.noreply.github.com`;
        const user = await store.ensureUser(resolvedEmail);
        await auditLog(req as any, "auth.github_login", { userId: user.id });
        app.log.info({ event: "auth.github_login", githubUser: gh.login, userId: user.id }, "github login");
        if (deviceName) {
          await store.registerDevice(user.id, deviceName, platform ?? "github-oauth");
        }
        const pair = issuePair(user);
        return { ...pair, userId: user.id, email: resolvedEmail, githubUser: gh.login, provider: "github" };
      } catch (e) {
        req.log.error({ err: e }, "github oauth failed");
        return reply.status(502).send({ error: "GitHub OAuth failed" });
      }
    }

    if (isProd()) {
      return reply.status(501).send({
        error: "GitHub OAuth not configured. Set GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET and send an OAuth code.",
      });
    }
    // Dev/MVP mock (preserves existing CLI/tests behavior).
    if (!email || !githubUser) {
      return reply.status(400).send({ error: "email and githubUser are required in dev mock mode" });
    }
    if (!/^[a-zA-Z0-9-]+$/.test(githubUser)) {
      return reply.status(400).send({ error: "Invalid GitHub username" });
    }
    const user = await store.ensureUser(email);
    await auditLog(req as any, "auth.github_login", { userId: user.id });
    app.log.info({ event: "auth.github_login", email, githubUser, userId: user.id }, "github login");
    if (deviceName) {
      await store.registerDevice(user.id, deviceName, platform ?? "github-oauth");
    }
    const pair = issuePair(user);
    return { ...pair, userId: user.id, email, githubUser, provider: "github" };
  });

  // OAuth callback placeholder for browser flow (spec §51 GitHub integration)
  app.get("/github/callback", async (req, reply) => {
    const { code, state } = (req as any).query as { code?: string; state?: string };
    if (!code) return reply.status(400).send({ error: "Missing OAuth code. In production, redirect to GitHub OAuth." });
    // Exchange happens in POST /v1/auth/github with { code } when server is configured.
    return { message: "GitHub OAuth callback received. Exchange the code via POST /v1/auth/github.", code, state };
  });

  app.post("/logout", async (req, reply) => {
    const auth = req.headers.authorization;
    const bodyRefresh = ((req as any).body as { refreshToken?: string } | undefined)?.refreshToken;
    if (auth) {
      const token = auth.slice(7);
      if (token.split(".").length === 3) {
        const payload = verifyJwt(token);
        if (payload) await store.revokeJti(payload.jti);
      } else {
        await store.revokeToken(token);
      }
      await auditLog(req as any, "auth.logout");
    }
    if (bodyRefresh) {
      const payload = verifyJwt(bodyRefresh);
      if (payload) await store.revokeJti(payload.jti);
    }
    return { ok: true };
  });

  app.post("/refresh", async (req, reply) => {
    const bodyToken = ((req as any).body as { refreshToken?: string } | undefined)?.refreshToken;
    const auth = req.headers.authorization;
    const incoming = bodyToken ?? (auth ? auth.slice(7) : undefined);
    if (!incoming) return reply.status(401).send({ error: "No token" });

    // JWT path: rotate (revoke presented token, issue fresh pair).
    if (incoming.split(".").length === 3) {
      const payload = verifyJwt(incoming);
      if (!payload) return reply.status(401).send({ error: "Invalid token" });
      if (await store.isJtiRevoked(payload.jti)) return reply.status(401).send({ error: "Invalid token" });
      const user = await store.getUserByEmail(payload.email);
      if (!user || user.id !== payload.sub) return reply.status(401).send({ error: "Invalid token" });
      await store.revokeJti(payload.jti);
      const pair = issuePair(user);
      return pair;
    }

    // Legacy opaque path (older clients).
    const newToken = await store.rotateToken(incoming);
    if (!newToken) return reply.status(401).send({ error: "Invalid token" });
    return { token: newToken };
  });

  app.get("/me", async (req, reply) => {
    const h = req.headers.authorization;
    if (!h) return reply.status(401).send({ error: "Unauthorized" });
    const token = h.slice(7);
    if (token.split(".").length === 3) {
      const payload = verifyJwt(token);
      if (!payload || (await store.isJtiRevoked(payload.jti))) {
        return reply.status(401).send({ error: "Invalid token" });
      }
      const user = await store.getUserByEmail(payload.email);
      if (!user || user.id !== payload.sub) return reply.status(401).send({ error: "Invalid token" });
      return { userId: user.id, email: user.email };
    }
    const user = await store.getUserByToken(token);
    if (!user) return reply.status(401).send({ error: "Invalid token" });
    return { userId: user.id, email: user.email };
  });

  // Device management per spec §31
  app.get("/devices", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.status(401).send({ error: "Unauthorized" });
    const token = auth.slice(7);
    const user = await resolveUser(token);
    if (!user) return reply.status(401).send({ error: "Invalid token" });
    return store.listDevices(user.id);
  });

  app.delete("/devices/:id", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.status(401).send({ error: "Unauthorized" });
    const token = auth.slice(7);
    const user = await resolveUser(token);
    if (!user) return reply.status(401).send({ error: "Invalid token" });
    const { id } = (req as any).params;
    await store.revokeDevice(id);
    await auditLog(req as any, "device.revoke", { userId: user.id, deviceId: id });
    return { ok: true };
  });
}

async function resolveUser(token: string): Promise<{ id: string; email: string } | null> {
  if (token.split(".").length === 3) {
    const payload = verifyJwt(token);
    if (!payload || (await store.isJtiRevoked(payload.jti))) return null;
    const user = await store.getUserByEmail(payload.email);
    if (!user || user.id !== payload.sub) return null;
    return user;
  }
  return store.getUserByToken(token);
}
