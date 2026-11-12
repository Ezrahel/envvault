-- EnvVault migration 0005: tenancy + integrity hardening (CockroachDB/PostgreSQL compatible)
-- 1) One row per (file, version): concurrent pushes can no longer mint duplicate
--    version numbers; the API retries on conflict.
CREATE UNIQUE INDEX IF NOT EXISTS "secret_versions_file_version_unique" ON "secret_versions" ("environment_file_id", "version");

-- 2) Case-insensitive email lookups (login normalizes to lowercase).
CREATE INDEX IF NOT EXISTS "users_email_lower_idx" ON "users" (lower("email"));

-- 3) Hot-path indexes for per-user scoping.
CREATE INDEX IF NOT EXISTS "devices_user_idx" ON "devices" ("user_id");
CREATE INDEX IF NOT EXISTS "environment_files_env_idx" ON "environment_files" ("environment_id");
