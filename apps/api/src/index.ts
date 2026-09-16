import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { environmentRoutes } from "./routes/environments.js";
import { versionRoutes } from "./routes/versions.js";
import { loadEnv, corsOrigins } from "./lib/env.js";
import { initStore, flushSnapshot } from "./lib/store.js";

// Validate environment first — fail fast in production on missing secrets.
const env = loadEnv();

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL ?? "info",
    ...(env.NODE_ENV !== "production" ? { transport: { target: "pino-pretty" } } : {}),
  } as any,
  // Correct client IPs behind reverse proxies (rate-limit + audit hashing).
  trustProxy: true,
});

// Security headers (API: deny framing, no sniffing, minimal CSP, HSTS in prod).
app.addHook("onRequest", async (_req, reply) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "no-referrer");
  reply.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  if (env.NODE_ENV === "production") {
    reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
});

const origins = corsOrigins(env);
await app.register(cors, {
  // Closed by default: same-origin/CLI only in prod until CORS_ORIGINS is set.
  origin: origins === false ? false : origins,
});
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

// Global error handler – never leak secrets
app.setErrorHandler((err: any, _req, reply) => {
  const safeMessage = String(err.message ?? "").replace(/DATABASE_URL=.+|JWT_SECRET=.+|SECRET=.+/gi, "[redacted]");
  app.log.error({ err: safeMessage, stack: err.stack }, "request error");
  reply.status(err.statusCode ?? 500).send({ error: safeMessage, requestId: _req.id });
});

app.get("/health", async () => {
  const { checkDbHealth } = await import("./lib/db.js");
  const dbHealth = await checkDbHealth();
  return { status: "ok", version: "0.1.0", db: dbHealth, uptime: process.uptime() };
});

app.get("/ready", async (_req, reply) => {
  const { checkDbHealth } = await import("./lib/db.js");
  const db = await checkDbHealth();
  if (!db.ok) return reply.status(503).send({ status: "degraded", db });
  return { status: "ready", db };
});

await app.register(authRoutes, { prefix: "/v1/auth" });
await app.register(projectRoutes, { prefix: "/v1" });
await app.register(environmentRoutes, { prefix: "/v1" });
await app.register(versionRoutes, { prefix: "/v1" });

// Boot the store: CockroachDB via Drizzle when DATABASE_URL is set
// (migrations run here), otherwise in-memory + disk snapshot.
await initStore();

const port = Number(env.PORT ?? 3001);
const host = env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
  console.log(`EnvVault API listening on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Graceful shutdown for Docker / K8s (SIGTERM) and Ctrl+C (SIGINT) —
// lets Fastify drain connections and close DB instead of hard-killing.
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "shutting down");
  try {
    await flushSnapshot();
    await app.close();
    const { closeDb } = await import("./lib/db.js");
    await closeDb();
  } catch (err) {
    app.log.error({ err }, "error during shutdown");
  } finally {
    process.exit(0);
  }
}
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => void shutdown(sig));
}

export { app };
