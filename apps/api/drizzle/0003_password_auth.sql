-- EnvVault migration 0003: password auth + JWT revocation
-- Adds password_hash to users and a revoked_tokens table for logout/refresh rotation.
-- (The runtime store still snapshots to disk on single-node; this prepares the Drizzle cutover.)

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;

CREATE TABLE IF NOT EXISTS "revoked_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "jti" varchar(100) NOT NULL UNIQUE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "revoked_tokens_expires_idx" ON "revoked_tokens" ("expires_at");
