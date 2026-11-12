import { buildApp } from "./app.js";
import { loadEnv } from "./lib/env.js";
import { initStore, flushSnapshot } from "./lib/store.js";
import { closeDb } from "./lib/db.js";

// Validate environment first — fail fast in production on missing secrets.
const env = loadEnv();

// Boot the store before accepting traffic: CockroachDB via Drizzle when
// DATABASE_URL is set (migrations run here), otherwise in-memory + snapshot.
const backend = await initStore();

const app = await buildApp();

process.on("unhandledRejection", (reason) => {
  app.log.error({ err: reason instanceof Error ? { message: reason.message, stack: reason.stack } : reason }, "unhandledRejection");
});
process.on("uncaughtException", (err) => {
  app.log.fatal({ err: { message: err.message, stack: err.stack } }, "uncaughtException — exiting");
  process.exit(1);
});

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info({ backend, port: env.PORT, env: env.NODE_ENV }, "EnvVault API listening");
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Graceful shutdown (SIGTERM from Docker/K8s, SIGINT from Ctrl+C):
// stop accepting, drain in-flight requests, flush, close the DB pool.
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "shutting down");
  const force = setTimeout(() => process.exit(1), 15_000);
  force.unref();
  try {
    await app.close();
    await flushSnapshot();
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
