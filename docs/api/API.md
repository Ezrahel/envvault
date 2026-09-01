# EnvVault API (§32-33, §71-74)

Base: `https://api.envvault.dev` (local `http://localhost:3001`, `PORT` env). All routes Zod-validated (§71), per-user scoping (§69), `Authorization: Bearer <token>`, `x-ratelimit-*` (§70).

## Health

```
GET /health → {status, version, db:{ok, latencyMs}, uptime}
GET /ready  → 200 ready / 503 degraded
GET /health ──pino structured logs, error redaction──▶ never DATABASE_URL
```

## Auth

```
POST /v1/auth/login   {email, name?, deviceName?, platform?} → {token, userId}
POST /v1/auth/github  {email, githubUser, provider:"github"} → {token, userId, githubUser}  (§51 GitHub OAuth, least privilege)
GET  /v1/auth/github/callback?code=&state= → mock placeholder
POST /v1/auth/logout  (Bearer) → {ok}
POST /v1/auth/refresh (Bearer) → {token}
GET  /v1/auth/me      (Bearer) → {userId, email}
GET  /v1/auth/devices (Bearer) → Device[]
DELETE /v1/auth/devices/:id (Bearer) → {ok}  (revoke)
```

Tokens are `envvault_mock_<b64(email)><uuid>` (MVP, prod would be JWT + `store.rotateToken`). Devices `registerDevice` on login.

## Projects (unique `user_id+canonical_remote` §31)

```
GET    /v1/projects              → Project[]
POST   /v1/projects              {provider, host, owner?, repository, canonicalRemote} → 201 Project (idempotent)
GET    /v1/projects/:id          → Project or 404/403
DELETE /v1/projects/:id          → {ok}
```

Example `canonicalRemote: github.com/<username>/<repository>` (§9-10).

## Environments & Files (§15)

```
GET  /v1/projects/:id/environments          → Environment[]
POST /v1/projects/:id/environments {name}   → 201 Environment
GET  /v1/environments/:id/files             → EnvFile[]
POST /v1/environments/:id/files {fileName}  → 201 EnvFile
```

## Encrypted Payloads (§21, §33, §67-68)

Client envelope (§78): `{formatVersion:1, algorithm:"AES-256-GCM", keyVersion:1, nonce:base64, ciphertext:base64, authTag:base64}`. Server stores **ciphertext only** (`secret_versions.objectKey`, `cipherAlgorithm`, `nonce`) + `getStorage().putObject(key, Buffer)` (local `data/object-storage` or R2 private bucket, `generateSignedUrl` 900s, no public access).

```
POST /v1/environment-files/:id/versions                → {version, id, objectKey} 201
POST /v1/environment-files/mock/versions               → alias for CLI (canonicalRemote+fileName in body)
GET  /v1/environment-files/:id/versions?canonicalRemote=&fileName= → EncryptedPayload[] (scoped to user)
GET  /v1/environment-files/mock/versions?canonicalRemote=&fileName= → same
GET  /v1/environment-files/:id/versions/:version?canonicalRemote=&fileName= → EncryptedPayload + signedUrl
GET  /v1/storage/signed/:key                           → raw Buffer (private)
```

Example upload body (§33):
```json
{
  "project": {"provider":"github","host":"github.com","owner":"<username>","repository":"<repository>","canonicalRemote":"github.com/<username>/<repository>"},
  "environment": {"name":"default","fileName":".env"},
  "encryption": {"algorithm":"AES-256-GCM","keyVersion":1,"nonce":"...","authTag":"..."},
  "ciphertext":"..."
}
```

## Validation & Errors

Zod `safeParse` → `400 {error}`, `401` for `Bearer` missing/invalid, `403` for ownership, `404` for not found, `500` redacted. `app.setErrorHandler` replaces `SECRET` with `[redacted]`.

## Rate Limiting & Audit

`@fastify/rate-limit` `100/min`, `store.audit({userId,projectId,action,ipHash})` where `ipHash=sha256(ip).slice(0,16)` (§31). Logged `event` without secret values.

## Storage & DB

`apps/api/drizzle/0001_initial.sql` + `packages/database/src/schema.ts` (Drizzle). `getDb()` returns `drizzle(postgres)` if `DATABASE_URL` else `null` → in-memory `store` for dev/test. `isDbAvailable()` + `checkDbHealth()` for `/health`.
