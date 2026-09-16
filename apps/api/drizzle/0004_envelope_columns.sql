-- EnvVault migration 0004: envelope columns + environment creator (CockroachDB-compatible)
-- secret_versions gains the encrypted-envelope fields the API returns on listVersions.
-- NOTE: `ciphertext` holds the *encrypted* blob only — plaintext is never stored server-side.
-- Object storage (R2) remains the primary ciphertext store; the column keeps reads fast.

ALTER TABLE "secret_versions" ADD COLUMN IF NOT EXISTS "auth_tag" text;
ALTER TABLE "secret_versions" ADD COLUMN IF NOT EXISTS "ciphertext" text;
ALTER TABLE "secret_versions" ADD COLUMN IF NOT EXISTS "format_version" integer DEFAULT 1;

ALTER TABLE "environments" ADD COLUMN IF NOT EXISTS "created_by" uuid REFERENCES "users"("id");
