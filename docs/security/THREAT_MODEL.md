# Threat Model (§53)

## Assets

- Local `.env` plaintext (on developer laptop)
- Encrypted `ciphertext+nonce+authTag` in API / R2 / local vault
- Master encryption secret (derived key, OS keychain)
- Auth token (Bearer)

## Threats & Mitigations

| Threat | Impact | Mitigation | Status |
|---|---|---|---|
| **Stolen laptop** (attacker gets `auth.json` + OS) | Push/pull as user | OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) + `0600` fallback warning, session expiry, `revokeToken`, `revokeDevice` (API `DELETE /devices/:id`), per-device `lastSeenAt` | ✅ `store.revokeDevice`, `auth/store.ts` warns plaintext fallback |
| **Compromised server / DB / R2** (attacker dumps Postgres + R2) | Should not yield plaintext | Client-side AES-256-GCM, server stores **ciphertext only**, envelope `formatVersion+algorithm+keyVersion+nonce+authTag`, `AAD=canonicalRemote` binds project. Compromise → `ciphertext` without key is useless. Tested: vault `.json` never contains `postgres://` plaintext. | ✅ Crypto tests tamper → `Decryption failed` |
| **Malicious CLI update** (compromised `npm install -g envvault`) | Access plaintext pre-encrypt | Signed releases (`release.yml` generates `sha256` + `cosign` placeholder), reproducible `tsup` build, `pnpm audit` in CI (13 vulns flagged), minimal deps, `bundle-require` pinned | ✅ `release.yml` + `ci.yml` audit |
| **Malicious repo** (repo contains `postinstall` script that steals `auth.json`) | Credential theft | `envvault pull` **never** executes project code (`npm install`, `make` forbidden §53), only writes `.env` atomically, `0600` | ✅ `pull` only `atomicWriteFile` |
| **Secret leakage via logs** | `DATABASE_URL` in pino / error | `app.setErrorHandler` redacts `DATABASE_URL|JWT_SECRET|SECRET` → `[redacted]`, `process.on(unhandledRejection)` redacts, `auditLog` only `event,userId,projectId,deviceId,ipHash`, CLI `logger.safe` checks `SECRET` | ✅ |
| **Cross-account collision** (`projectId` from client) | User A reads B's project | Every route checks `store.getProjectById(userId,id)` / `findProjectByCanonical(userId,canonical)` before `listEnvironments/listVersions` (§69). In-memory store keys `userId:canonical`. | ✅ `projects.ts` 403, `environments.ts` 403, `versions.ts` scoped |
| **Symlink loop / huge scan** | DoS, privacy | `scanRoots` `realpath` visited set, `DEFAULT_IGNORE_DIRS` pruning, `maxDepth` 12/8, async iterable, `--path ~/Projects` preferred over full-disk (§93) | ✅ |
| **Existing file overwrite** | Loss of local `.env` | Never silently overwrite: `fileExists` → prompt `Skip/Backup/Overwrite`, `--yes` auto-backup `envvault-backup-YYYY-MM-DD[-counter]`, default `Skip`, `atomicWriteFile` prevents partial (§40-42) | ✅ `fileRestore.ts` tests 0600 |
| **Rate / abuse** | Bulk dump | `@fastify/rate-limit` `100/min` globally, `x-ratelimit-*` headers, higher limits for migration (future) (§70) | ✅ |

## Out-of-scope for MVP (deferred §49-50)

- Team RBAC, SSO, MFA, org recovery keys (Mode B/C), IP restrictions, approval workflows — noted for post-MVP.

## Verification

- `pnpm audit --prod` in CI, `grep -r sk_ packages/cli/src` check, `vitest` crypto tamper suite (wrong key, tampered nonce/tag/ciphertext, corrupted, unsupported version).
- `pnpm exec vitest run` 66 tests include `decrypt` auth-tag mismatch throws, `atomicWriteFile` 0600, `restore-all` `--force` vs skip.
- Manual: `PORT=34591` API + CLI `push` → `curl /mock/versions` shows `ciphertext` not `postgres://`, `SERVER compromise` simulation → plaintext not in `objectKey`.
