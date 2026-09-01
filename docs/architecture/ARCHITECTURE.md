# EnvVault Architecture

> **Invariant:** Local path is temporary. Git remote `github.com/owner/repo` → canonical → EnvVault Project ID (§104). Works across `/home/john/projects/<repository>`, `/home/mary/my-pdf-project`, `D:\Work\MyPDF`.

## High-Level (§30, §123)

```
Developer
   │
  envvault CLI (Node 22, TS strict, Commander, Inquirer, tsup)
   ├── Git identity (normalizeRemote) ──┐
   ├── .env discovery (scanRoots) ──────┤
   └── local AES-256-GCM (scrypt KDF)  │
                    │                   │
              encrypted payload (formatVersion:1, nonce, authTag, ciphertext, AAD=canonical)
                    │ HTTPS
                    ▼
             EnvVault API (Fastify 5, Zod, @fastify/cors+rate-limit, pino)
                    ├── Postgres (Drizzle, metadata only, unique user_id+canonical)
                    └── R2/S3 (private, SSE, private bucket, presigned URLs 900s)
                    │
                 HTTPS
                    │
             Web App (Next.js 15, /projects/[id], /environments, /versions, /devices)
```
- **CLI is core** (§113); dashboard shows metadata only, never plaintext (§83).

## Crypto (§21-23, §56, §78, §90)

- **Primitive:** AES-256-GCM (Node `crypto`), 12B random nonce per object, 16B tag, `AAD = canonicalRemote` binds project.
- **KDF:** `scrypt(secret, salt="envvault-salt-v1", 32)` → 32B key, `keyVersion:1`, `CryptoProvider {encrypt, decrypt}` abstraction.
- **Envelope:** `{formatVersion:1, algorithm:"AES-256-GCM", keyVersion:1, nonce:base64, ciphertext:base64, authTag:base64}`. Versioned for migration (§78, §90). Tests for tampered ciphertext/nonce/tag, NDSS.
- **Key mgmt:** `master secret → KDF → encryption key`; server gets only `ciphertext+metadata` (§23). Recovery Mode A (user controls key, loss = unrecoverable) explicit (§24).

## Git Identity (§9-13, §35-37, §105-110)

- **Algorithm:** `startPath → parent walk → .git exists (dir or file for worktrees) → git remote get-url origin (fallback upstream → first) → normalizeRemote → ProjectIdentity`.
- **Normalize:** strips protocol (`https://`, `ssh://`, `git@`), SSH user, port, trailing slash, `.git`, lowercases host, preserves `owner/subgroup/repo`, detects `github|gitlab|bitbucket|unknown`. Example: `git@github.com:<username>/<repository>.git` → `github.com/<username>/<repository>`.
- **Edge:** fork `<username>/pdf ≠ john/pdf`, remote change → new project unless `link`, worktree file `gitdir:` supported, nested `use nearest`, bare/detached/submodule noted (§105), future `providerRepositoryId` for renames (§109-110).

## Scanner (§17-20, §92, §105)

- **Roots:** `~/Projects, ~/Development, ~/Code, ~/Work` from `~/.config/envvault/config.json` (XDG), `ENVVAULT_API_URL`, `ENVVAULT_CONFIG_DIR` env overrides.
- **Discovery:** `scanRoots(roots, {followSymlinks:false, ignoreDirs, maxDepth:12})` as `AsyncIterable<DiscoveredFile>` (no bulk load), `readdir` async, prunes `DEFAULT_IGNORE_DIRS` (`.git,node_modules,vendor,target,dist,build,.cache,.next`), `realpath` visited set prevents symlink loops, `EACCES/EPERM` graceful skip (no sudo) with `⚠ Skipped` note.
- **Classification:** `isEnvFile` excludes `.env.example/.sample/.template` unless explicit, `classifyEnvironment` `.env→default` etc., custom map support.

## CLI (§34, §58-62, §94-95)

- **Commands (12):** `login (--github)`, `logout`, `init`, `scan (--json, --follow-symlinks)`, `status`, `projects`, `push/pull (--yes, --all, --force)`, `env list/push/pull`, `backup (--dry-run, multi) `, `restore (--path, --force, single|multi)`, `restore-all (only missing)`, `watch (--yes auto)`, `diff (--file)`, `versions (--json)`.
- **Restore:** `atomicWriteFile (tmp 0600, fsync, rename)` + `backupExistingFile (date+counter)`; conflict prompt `Skip/Backup/Overwrite`, `--yes` auto-backup.
- **Offline/Cancellation:** `scan/status` offline, `push/pull` require net; `Ctrl+C` closes `FSWatcher` and cleans `.tmp` (§94).

## API (§32-33, §67-74, §99-101)

- **Routes:** Zod validation, `authenticate` via `store.getUserByToken` (fixes cross-user collision), per-request scoping `findProjectByCanonical(userId,canonical)` (§69), `auditLog` IP-hash.
- **DB:** `users, projects (unique), environments, environment_files, secret_versions (objectKey,cipherAlgorithm,nonce), devices, audit_logs` + `drizzle/0001_initial.sql` (PITR, encrypted backups). `isDbAvailable()` falls back to in-memory `Map`s for dev/test.
- **Storage:** `LocalStorage` (dev, `data/object-storage`) / `R2Storage` (prod, `S3Client`, private bucket, no public access, presigned 900s) via `getStorage()`, key `users/{userId}/projects/{id}/...`.
- **Observability:** `pino` structured `event`, `x-ratelimit-*`, `health/ready` with DB latency, error redaction `SECRET` → `[redacted]`.

## Web (§83)

- **Pages:** `/` live `fetchProjects` stats, `/projects` cards → `[id]` detail (clone+pull snippet), `/environments` mock, `/versions` table (cipher history), `/devices` revoke, `/account` recovery model, `/security` threat matrix. All fetch `NEXT_PUBLIC_API_URL` with `no-store`, show metadata only.

## Monorepo §87

`pnpm workspace` + `tsconfig.base.json` strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes:false` after fix) + `vitest` + `tsup` + `tsx` + `drizzle-kit`.
