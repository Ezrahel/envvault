import * as schema from "@envvault/database";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";

/**
 * CockroachDB connection (Postgres-wire compatible) — per §99-100
 * Production: CockroachDB Cloud (multi-region, automated backups, encryption at rest)
 *   DATABASE_URL=postgresql://<user>:<pass>@<host>:26257/envvault?sslmode=verify-full
 *   (the `cockroachdb://` scheme is also accepted and normalized below)
 * Development: single-node Cockroach in compose, or unset DATABASE_URL for
 *   in-memory + disk snapshot.
 *
 * `prepare: false` — CockroachDB (and PgBouncer-style poolers) don't support
 * the extended-protocol prepared statements postgres-js uses by default.
 */

export type Db = ReturnType<typeof drizzle>;

let db: Db | null = null;
let client: ReturnType<typeof postgres> | null = null;
// Test override (PGlite-backed integration tests) — bypasses the real client.
let overrideDb: Db | null = null;

/** Test-only: force getDb() to return a provided instance (e.g. PGlite). */
export function __setDbOverride(d: Db | null): void {
  overrideDb = d as Db | null;
}

export function normalizeDatabaseUrl(url: string): string {
  const trimmed = url.trim();
  // postgres-js parses standard schemes; normalize CockroachDB's custom scheme.
  if (trimmed.startsWith("cockroachdb://")) return "postgresql://" + trimmed.slice("cockroachdb://".length);
  if (trimmed.startsWith("cockroach://")) return "postgresql://" + trimmed.slice("cockroach://".length);
  return trimmed;
}

export function getDb(): Db | null {
  if (overrideDb) return overrideDb;
  const raw = process.env.DATABASE_URL;
  if (!raw) return null;
  if (db) return db;
  try {
    client = postgres(normalizeDatabaseUrl(raw), {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      // Required for CockroachDB; harmless (slightly slower) on plain Postgres
      // and required for transaction poolers.
      prepare: false,
    });
    db = drizzle(client, { schema });
    return db;
  } catch (e) {
    console.warn("Failed to connect to database, falling back to in-memory:", (e as Error).message);
    return null;
  }
}

/** Test helper: build a Db over any postgres-js compatible client (e.g. pg-proxy). */
export function wrapClient(c: ReturnType<typeof postgres>): Db {
  return drizzle(c as any, { schema });
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

export function isDbAvailable(): boolean {
  return !!process.env.DATABASE_URL;
}

// For health checks
export async function checkDbHealth(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  const d = getDb();
  if (!d) return { ok: true, latencyMs: 0 }; // in-memory is always ok
  try {
    // simple query
    await d.execute(sql`SELECT 1`);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
