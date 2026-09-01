-- EnvVault initial migration per spec §31 Database Schema
-- Production PostgreSQL with point-in-time recovery, encrypted backups, retention

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(255) NOT NULL UNIQUE,
  "name" text,
  "avatar_url" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" varchar(20) NOT NULL,
  "host" varchar(255) NOT NULL,
  "owner" varchar(255),
  "repository" varchar(255) NOT NULL,
  "canonical_remote" varchar(512) NOT NULL,
  "provider_repository_id" varchar(100),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "user_canonical_unique" UNIQUE ("user_id", "canonical_remote")
);
CREATE INDEX IF NOT EXISTS "projects_canonical_idx" ON "projects" ("canonical_remote");
CREATE INDEX IF NOT EXISTS "projects_provider_id_idx" ON "projects" ("provider_repository_id");

CREATE TABLE IF NOT EXISTS "environments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" varchar(100) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "project_env_unique" UNIQUE ("project_id", "name")
);

CREATE TABLE IF NOT EXISTS "environment_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "environment_id" uuid NOT NULL REFERENCES "environments"("id") ON DELETE CASCADE,
  "file_name" varchar(100) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "env_file_unique" UNIQUE ("environment_id", "file_name")
);

CREATE TABLE IF NOT EXISTS "secret_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "environment_file_id" uuid NOT NULL REFERENCES "environment_files"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "object_key" text NOT NULL,
  "cipher_algorithm" varchar(50) NOT NULL,
  "key_version" integer NOT NULL,
  "nonce" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "created_by" uuid REFERENCES "users"("id")
);
CREATE INDEX IF NOT EXISTS "secret_versions_env_file_idx" ON "secret_versions" ("environment_file_id");

CREATE TABLE IF NOT EXISTS "devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "platform" varchar(50),
  "last_seen_at" timestamp DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "revoked_at" timestamp
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid REFERENCES "users"("id"),
  "project_id" uuid REFERENCES "projects"("id"),
  "action" varchar(100) NOT NULL,
  "device_id" uuid REFERENCES "devices"("id"),
  "ip_hash" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "audit_logs_user_idx" ON "audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_project_idx" ON "audit_logs" ("project_id");

-- Ensure ciphertext is never stored in DB, only object storage per §21
-- RLS or app-level checks must enforce (user_id, canonical_remote) scoping per §69
