import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { environmentRoutes } from "./routes/environments.js";
import { versionRoutes } from "./routes/versions.js";
import { loadEnv, corsOrigins, trustProxySetting } from "./lib/env.js";
import { checkDbHealth } from "./lib/db.js";
import { isDbMode } from "./lib/store.js";
import { r2Configured } from "./lib/storage.js";

export const API_VERSION = "0.1.0";

export interface BuildOptions {
  /** Pass `false` to silence logs (tests). Defaults to env-configured pino. */
  logger?: boolean;
  /** Pass `false` to disable rate limiting (tests). */
  rateLimit?: boolean;
}

/**
 * Build the fully-configured API (hooks, limits, error handling, routes)
 * without listening. `index.ts` listens; tests `inject()` against this.
 */
export async function buildApp(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const env = loadEnv();
  const isProd = env.NODE_ENV === "production";

  const app = Fastify({
    logger:
      opts.logger === false
        ? false
        : {
            level: env.LOG_LEVEL,
            // Never log credentials, even by accident.
            redact: {
              paths: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.refreshToken", "*.token", "*.ciphertext"],
              censor: "[redacted]",
            },
            ...(isProd ? {} : { transport: { target: "pino-pretty" } }),
          },
    // Hop counts are valid at runtime (proxy-addr) but missing from Fastify's types.
    trustProxy: trustProxySetting(env.TRUST_PROXY) as boolean,
    // Ciphertext envelopes are small; 3 MB covers the 2 MB base64 cap + JSON framing.
    bodyLimit: 3 * 1024 * 1024,
    requestTimeout: 30_000,
    connectionTimeout: 60_000,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Security headers on every response (API only — no HTML is served).
  app.addHook("onSend", async (req, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    reply.header("Cross-Origin-Resource-Policy", "same-site");
    reply.header("X-Request-Id", req.id);
    if (isProd) reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    if (req.url.startsWith("/v1/")) reply.header("Cache-Control", "no-store");
    return payload;
  });

  const origins = corsOrigins(env);
  await app.register(cors, {
    origin: origins === false ? false : origins,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
    maxAge: 600,
  });

  if (opts.rateLimit !== false) {
    await app.register(rateLimit, {
      global: true,
      max: env.RATE_LIMIT_MAX,
      timeWindow: "1 minute",
      // Health probes must never be throttled.
      allowList: (req) => req.url === "/health" || req.url === "/ready",
    });
  }

  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({ error: "Not found", requestId: req.id });
  });

  // Clients get a safe message; details go to logs only.
  app.setErrorHandler((err: any, req, reply) => {
    const status = typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
    if (status >= 500) {
      req.log.error({ err: { message: err.message, code: err.code, stack: err.stack } }, "request failed");
      return reply.status(status).send({ error: "Internal server error", requestId: req.id });
    }
    if (status === 429) return reply.status(429).send({ error: "Too many requests. Slow down and retry shortly.", requestId: req.id });
    const message = err.code === "FST_ERR_CTP_INVALID_JSON_BODY" || err.code?.startsWith?.("FST_ERR_CTP") ? "Invalid request body" : String(err.message ?? "Bad request").slice(0, 300);
    return reply.status(status).send({ error: message, requestId: req.id });
  });

  // Liveness: process is up. Never touches dependencies (a DB blip must not restart the container).
  app.get("/health", async () => ({ status: "ok", version: API_VERSION }));

  // Readiness: dependencies reachable. Load balancers should route on this.
  app.get("/ready", async (_req, reply) => {
    const db = await checkDbHealth();
    const body = {
      status: db.ok ? "ready" : "degraded",
      version: API_VERSION,
      backend: isDbMode() ? "database" : "memory",
      storage: r2Configured() ? "r2" : "local",
      db: { ok: db.ok, latencyMs: db.latencyMs },
    };
    if (!db.ok) return reply.status(503).send(body);
    return body;
  });

  await app.register(authRoutes, { prefix: "/v1/auth" });
  await app.register(projectRoutes, { prefix: "/v1" });
  await app.register(environmentRoutes, { prefix: "/v1" });
  await app.register(versionRoutes, { prefix: "/v1" });

  return app;
}
