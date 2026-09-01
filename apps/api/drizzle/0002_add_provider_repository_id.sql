-- Add providerRepositoryId for GitHub rename resilience per §109-110
-- Allows projects to be found by stable provider ID even after canonicalRemote changes
-- Priority: providerRepositoryId > canonicalRemote > explicit mapping

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "provider_repository_id" varchar(100);
CREATE INDEX IF NOT EXISTS "projects_provider_id_idx" ON "projects" ("provider_repository_id");
