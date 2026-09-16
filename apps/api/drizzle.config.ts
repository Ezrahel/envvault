import { defineConfig } from "drizzle-kit";

// drizzle-kit has no CockroachDB-specific dialect; `postgresql` generates
// compatible SQL for our schema. Migrations in ./drizzle are hand-maintained
// and applied by the API's own runner (lib/migrate.ts) — Cockroach-safe
// (no extensions, no PG-only constructs).

export default defineConfig({
  schema: "../packages/database/src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://root@localhost:26257/envvault?sslmode=disable",
  },
});
