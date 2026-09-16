import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { normalizeDatabaseUrl } from "./db.js";

/**
 * File-based migration runner (CockroachDB + PostgreSQL compatible).
 * Applies `drizzle/*.sql` in filename order, tracking state in
 * `_envvault_migrations` so each file runs exactly once.
 * All bundled migrations are idempotent (IF NOT EXISTS) as a second layer.
 */

const MIGRATIONS_TABLE = "_envvault_migrations";

export async function listMigrationFiles(dir?: string): Promise<string[]> {
  const candidates = dir
    ? [dir]
    : [
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "drizzle"),
        path.resolve(process.cwd(), "apps", "api", "drizzle"),
        path.resolve(process.cwd(), "drizzle"),
      ];
  for (const d of candidates) {
    try {
      const entries = await fs.readdir(d);
      return entries
        .filter((f) => f.endsWith(".sql"))
        .sort()
        .map((f) => path.join(d, f));
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    `Migration directory not found (tried: ${candidates.join(", ")}). ` +
      `When deploying the bundled dist/index.js, copy apps/api/drizzle next to it or set working directory to the repo root.`
  );
}

/** Split a migration file into statements (naive `;` split — our files have no tricky semicolons). */
export function splitStatements(sqlText: string): string[] {
  const noLineComments = sqlText
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n");
  return noLineComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function runMigrations(databaseUrl = process.env.DATABASE_URL): Promise<string[]> {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set — cannot run migrations");
  const client = postgres(normalizeDatabaseUrl(databaseUrl), { max: 1, prepare: false });
  try {
    await client.unsafe(
      `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`
    );
    const appliedRows = await client.unsafe(`SELECT filename FROM "${MIGRATIONS_TABLE}"`);
    const applied = new Set(appliedRows.map((r: any) => r.filename as string));

    const files = await listMigrationFiles();
    const newlyApplied: string[] = [];
    for (const file of files) {
      const name = path.basename(file);
      if (applied.has(name)) continue;
      const sqlText = await fs.readFile(file, "utf-8");
      for (const stmt of splitStatements(sqlText)) {
        await client.unsafe(stmt);
      }
      await client.unsafe(`INSERT INTO "${MIGRATIONS_TABLE}" (filename) VALUES ($1)`, [name]);
      newlyApplied.push(name);
    }
    if (newlyApplied.length > 0) {
      console.log(`[migrate] applied: ${newlyApplied.join(", ")}`);
    } else {
      console.log("[migrate] up to date");
    }
    return newlyApplied;
  } finally {
    await client.end();
  }
}
