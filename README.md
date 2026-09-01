# EnvVault

> **Your development environment, available on any machine.**
> *Clone your project. Run one command. Get your environment back.*

A developer-first, **project-aware** secrets backup/restoration platform. Discovers local `.env*` files, associates them with **Git repositories (canonical remote)** rather than folder names, encrypts client-side (AES-256-GCM), stores ciphertext in cloud, restores automatically after machine migration.

```
OLD:  .env → nearest .git → git remote → canonical (github.com/owner/repo) → encrypt → HTTPS → API → Postgres + R2
NEW:  git clone → envvault pull → decrypt → .env (0600, atomic)
```

## Monorepo
```
envvault/
├── apps/
│   ├── web/   (Next.js 15 dashboard)
│   └── api/   (Fastify 5 + Zod + Drizzle + Postgres + R2 + rate-limit)
├── packages/
│   ├── cli/          Commander, 12 commands, tsup-bundled 79KB
│   ├── crypto/       AES-256-GCM, scrypt KDF, versioned envelope
│   ├── git/          normalizeRemote, findGitRoot, worktree, multi-remote
│   ├── env-parser/   scanRoots AsyncIterable, ignore rules, symlink handling
│   ├── config/       OS paths (Linux ~/.config, macOS Library, Windows APPDATA)
│   ├── shared/       ProjectIdentity, EXIT_CODES, classification
│   ├── sdk/          ApiClient (listProjects, upload/listVersions)
│   ├── database/     Drizzle schema + 0001_initial.sql
│   └── ui/           shared components
├── tests/  (integration, e2e with real git repos)
├── infra/  (docker-compose, Dockerfile.api/web, terraform)
├── docs/   (architecture, security, api, cli)
└── .github/workflows/ (ci.yml, release.yml)
```

## Quick Start

```bash
pnpm install
pnpm -r typecheck   # 11/11
pnpm exec vitest run # 66 tests
pnpm --filter envvault build # CLI 67KB
pnpm --filter @envvault/web build
```

### CLI (core product)

```bash
npm install -g envvault
envvault init                          # → ~/.config/envvault/config.json
envvault login --email you@example.com # or --github (OAuth, §51)
envvault scan --path ~/Projects        # discover + Git identity
envvault status                        # current repo + env files
envvault push --yes                    # encrypt + upload (per-repo)
envvault pull --yes                    # download + decrypt + atomic restore
# Migration (multi-repo)
envvault backup --dry-run              # preview
envvault backup --yes                  # scan all roots → push all
envvault restore --yes                 # scan/cwd → pull missing (or --path ~/Projects)
envvault restore-all --path ~/Projects # only missing, --force to overwrite (§66)

# Utilities
envvault diff --file .env              # Added/Removed keys only, values hidden (§46)
envvault versions --file .env          # v1, v2 … cipher history (§47)
envvault watch --path ~/Projects --yes # auto-backup new .env (§63, never auto without --yes)
envvault projects                      # list cloud projects
envvault env list|push|pull            # per-environment aliases
```

### API
```bash
cd apps/api
DATABASE_URL=postgres://... PORT=3001 pnpm dev # http://localhost:3001/health
# Routes: POST /v1/auth/{login,github,logout,refresh}, GET /v1/projects, POST /v1/projects,
# GET/POST /v1/projects/:id/environments, GET/POST /v1/environments/:id/files,
# POST/GET /v1/environment-files/:id/versions, GET /v1/auth/devices
# Storage: Postgres (metadata) + R2/S3 (ciphertext, private, signed URLs 900s)
```

### Web Dashboard (metadata only, never plaintext §83)
```bash
cd apps/web
NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm dev # http://localhost:3000
# Pages: / (stats) /projects /projects/[id] /environments /versions /devices /account /security
```

## Security (§53, §72-73)

- Client-side AES-256-GCM (12B nonce, 16B tag, `formatVersion:1`, AAD=canonicalRemote), scrypt KDF, `0600` + `fsync+rename` atomic restore.
- Server stores **ciphertext only** (`objectKey: users/{userId}/projects/{id}/...`), private R2 bucket, no public URLs.
- Never logs `DATABASE_URL`/`SECRET`, never prints values, `pnpm audit` in CI, `Authorization: Bearer` per-request scoping (§69), `x-ratelimit-*` headers.
- Threat model: stolen laptop (OS keychain + device revoke + session expiry), compromised server (ciphertext), malicious CLI (signed releases), cross-account collision (userId scoping).

## Architecture

See `docs/architecture/ARCHITECTURE.md`, `docs/security/THREAT_MODEL.md`, `docs/api/API.md`, `docs/cli/USAGE.md` and `envvault-comprehensive-build-plan.md` (125 sections).

## License

MIT
