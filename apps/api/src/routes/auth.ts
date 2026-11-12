import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { store } from "../lib/store.js";
import { auditLog } from "../lib/audit.js";
import { signJwt, verifyJwt } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { authenticate, bearer, requireUser, resolveToken } from "../lib/auth.js";
import { emailSchema, uuidParam, zodMessage } from "../lib/validate.js";

const deviceFields = {
  deviceName: z.string().trim().min(1).max(255).optional(),
  platform: z.string().trim().max(50).optional(),
};

const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  name: z.string().trim().max(200).optional(),
  ...deviceFields,
});

const loginSchema = z.object({
  email: emailSchema,
  // Optional only so dev/test passwordless login keeps working; required in production.
  password: z.string().min(1).max(128).optional(),
  name: z.string().trim().max(200).optional(),
  ...deviceFields,
});

const githubSchema = z.object({
  code: z.string().min(1).max(512).optional(),
  // Dev mock only — ignored when real OAuth is configured.
  email: emailSchema.optional(),
  githubUser: z.string().min(1).max(39).optional(),
  provider: z.literal("github").optional(),
  ...deviceFields,
});

const refreshSchema = z.object({ refreshToken: z.string().min(10).max(4096).optional() }).passthrough();

const isProd = () => process.env.NODE_ENV === "production";
const GH_LOGIN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;

// A fixed, valid hash so login does equal work whether or not the email exists.
let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword("timing-equalizer-not-a-password"));

const INVALID_CREDENTIALS = "Invalid email or password";

async function issuePair(user: { id: string; email: string }, req: FastifyRequest, device?: { deviceName?: string | undefined; platform?: string | undefined }) {
  let did: string | undefined;
  if (device?.deviceName) {
    const d = await store.registerDevice(user.id, device.deviceName, device.platform ?? String(req.headers["user-agent"] ?? "unknown").slice(0, 50));
    did = d.id;
  }
  const token = signJwt({ sub: user.id, email: user.email, type: "access", did });
  const refreshToken = signJwt({ sub: user.id, email: user.email, type: "refresh", did });
  return { token, refreshToken, ...(did ? { deviceId: did } : {}) };
}

async function githubIdentity(code: string, clientId: string, clientSecret: string): Promise<{ login: string; id: number; email: string } | null> {
  const ctl = AbortSignal.timeout(10_000);
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    signal: ctl,
  });
  if (!tokenRes.ok) return null;
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return null;
  const headers = { Authorization: `Bearer ${access_token}`, "User-Agent": "envvault", Accept: "application/vnd.github+json" };
  const userRes = await fetch("https://api.github.com/user", { headers, signal: ctl });
  if (!userRes.ok) return null;
  const gh = (await userRes.json()) as { login?: string; id?: number };
  if (!gh.login || !GH_LOGIN.test(gh.login) || typeof gh.id !== "number") return null;
  // Only a *verified primary* email may identify an account (needs `user:email` scope).
  let email: string | undefined;
  const emailsRes = await fetch("https://api.github.com/user/emails", { headers, signal: ctl });
  if (emailsRes.ok) {
    const emails = (await emailsRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
    email = emails.find((e) => e.primary && e.verified)?.email;
  }
  // No verified email → a stable, unclaimable noreply identity tied to the GitHub user id.
  return { login: gh.login, id: gh.id, email: (email ?? `${gh.id}+${gh.login}@users.noreply.github.com`).toLowerCase() };
}

export async function authRoutes(app: FastifyInstance) {
  // Stricter per-IP limit on credential endpoints (no-op if rate limiting isn't registered).
  const authLimit = { config: { rateLimit: { max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10), timeWindow: "1 minute" } } };

  app.post("/register", authLimit, async (req, reply) => {
    const body = registerSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: zodMessage(body.error) });
    const { email, password, name, deviceName, platform } = body.data;

    // Any existing account (including passwordless GitHub accounts) blocks registration —
    // otherwise registering would let a stranger claim someone else's account.
    const user = await store.createUserWithPassword(email, hashPassword(password), name);
    if (!user) return reply.status(409).send({ error: "An account with this email already exists. Log in instead." });

    const pair = await issuePair(user, req, { deviceName, platform });
    await auditLog(req, "auth.register", { userId: user.id, deviceId: pair.deviceId });
    reply.status(201);
    return { ...pair, userId: user.id, email: user.email };
  });

  app.post("/login", authLimit, async (req, reply) => {
    const body = loginSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: zodMessage(body.error) });
    const { email, password, name, deviceName, platform } = body.data;

    let user = await store.getUserByEmail(email);

    if (isProd()) {
      if (!password) return reply.status(401).send({ error: INVALID_CREDENTIALS });
      const ok = verifyPassword(password, user?.passwordHash ?? getDummyHash());
      // Unknown email, passwordless account, or wrong password: same answer, same work.
      if (!user || !user.passwordHash || !ok) {
        await auditLog(req, "auth.login_failed", user ? { userId: user.id } : {});
        return reply.status(401).send({ error: INVALID_CREDENTIALS });
      }
    } else {
      // Dev/test: auto-provision and allow passwordless login for frictionless local use.
      if (!user) user = await store.ensureUser(email, name);
      if (user.passwordHash) {
        if (!password || !verifyPassword(password, user.passwordHash)) return reply.status(401).send({ error: INVALID_CREDENTIALS });
      } else if (password) {
        await store.setPasswordHash(user.id, hashPassword(password));
      }
    }

    const pair = await issuePair(user, req, { deviceName, platform });
    await auditLog(req, "auth.login", { userId: user.id, deviceId: pair.deviceId });
    return { ...pair, userId: user.id, email: user.email, name: user.name ?? name ?? user.email };
  });

  // GitHub OAuth: code → access token → GitHub user + verified primary email.
  app.post("/github", authLimit, async (req, reply) => {
    const body = githubSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: zodMessage(body.error) });
    const { code, email, githubUser, deviceName, platform } = body.data;
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (clientId && clientSecret) {
      if (!code) return reply.status(400).send({ error: "Missing OAuth code" });
      let gh: Awaited<ReturnType<typeof githubIdentity>>;
      try {
        gh = await githubIdentity(code, clientId, clientSecret);
      } catch (e) {
        req.log.warn({ err: (e as Error).message }, "github oauth failed");
        return reply.status(502).send({ error: "GitHub OAuth failed" });
      }
      if (!gh) return reply.status(401).send({ error: "GitHub OAuth failed" });
      const user = await store.ensureUser(gh.email);
      const pair = await issuePair(user, req, { deviceName, platform: platform ?? "github-oauth" });
      await auditLog(req, "auth.github_login", { userId: user.id, deviceId: pair.deviceId });
      return { ...pair, userId: user.id, email: user.email, githubUser: gh.login, provider: "github" };
    }

    if (isProd()) {
      return reply.status(501).send({ error: "GitHub OAuth is not configured on this server." });
    }
    // Dev mock (no OAuth app configured).
    if (!email || !githubUser || !GH_LOGIN.test(githubUser)) {
      return reply.status(400).send({ error: "email and a valid githubUser are required in dev mock mode" });
    }
    const user = await store.ensureUser(email);
    const pair = await issuePair(user, req, { deviceName, platform: platform ?? "github-oauth" });
    await auditLog(req, "auth.github_login", { userId: user.id, deviceId: pair.deviceId });
    return { ...pair, userId: user.id, email: user.email, githubUser, provider: "github" };
  });

  // Browser OAuth redirect target: hands the code to the client; exchange happens via POST /github.
  app.get("/github/callback", async (req, reply) => {
    const q = z.object({ code: z.string().min(1).max(512), state: z.string().max(512).optional() }).safeParse(req.query);
    if (!q.success) return reply.status(400).send({ error: "Missing OAuth code" });
    reply.header("Cache-Control", "no-store");
    return { message: "Exchange this code via POST /v1/auth/github.", code: q.data.code, state: q.data.state };
  });

  app.post("/logout", async (req) => {
    const access = bearer(req);
    const refreshToken = refreshSchema.safeParse(req.body ?? {}).data?.refreshToken;
    let userId: string | undefined;
    for (const t of [access, refreshToken]) {
      if (!t) continue;
      const p = verifyJwt(t);
      if (p) {
        userId = p.sub;
        await store.revokeJti(p.jti, p.sub, p.exp);
      }
    }
    if (userId) await auditLog(req, "auth.logout", { userId });
    return { ok: true };
  });

  // Rotate: a refresh token is single-use; presenting it yields a fresh pair bound to the same device.
  app.post("/refresh", authLimit, async (req, reply) => {
    const parsed = refreshSchema.safeParse(req.body ?? {});
    const incoming = parsed.data?.refreshToken ?? bearer(req);
    if (!incoming) return reply.status(401).send({ error: "Invalid token" });
    const resolved = await resolveToken(incoming, "refresh");
    if (!resolved) return reply.status(401).send({ error: "Invalid token" });
    await store.revokeJti(resolved.payload.jti, resolved.user.id, resolved.payload.exp);
    const did = resolved.payload.did;
    return {
      token: signJwt({ sub: resolved.user.id, email: resolved.user.email, type: "access", did }),
      refreshToken: signJwt({ sub: resolved.user.id, email: resolved.user.email, type: "refresh", did }),
    };
  });

  app.get("/me", { preHandler: [authenticate] }, async (req) => {
    const u = requireUser(req);
    return { userId: u.id, email: u.email, deviceId: u.deviceId };
  });

  app.get("/devices", { preHandler: [authenticate] }, async (req) => {
    const u = requireUser(req);
    return store.listDevices(u.id);
  });

  app.delete("/devices/:id", { preHandler: [authenticate] }, async (req, reply) => {
    const u = requireUser(req);
    const p = uuidParam.safeParse(req.params);
    if (!p.success) return reply.status(404).send({ error: "Device not found" });
    const ok = await store.revokeDevice(u.id, p.data.id);
    if (!ok) return reply.status(404).send({ error: "Device not found" });
    await auditLog(req, "device.revoke", { userId: u.id, deviceId: p.data.id });
    return { ok: true };
  });
}
