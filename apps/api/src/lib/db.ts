import * as schema from "@envvault/database";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * PostgreSQL connection — per spec §99-100
 * Production: automated backups, PITR, encrypted backups, retention
 * Development: if DATABASE_URL not set, fall back to in-memory store (store.ts)
 */

let db: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof postgres> | null = null;

export function getDb(): ReturnType<typeof drizzle> | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (db) return db;
  try {
    client = postgres(url, { max: 5, idle_timeout: 20 });
    db = drizzle(client, { schema });
    return db;
  } catch (e) {
    console.warn("Failed to connect to Postgres, falling back to in-memory:", (e as Error).message);
    return null;
  }
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
    await d.execute("SELECT 1" as any);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
