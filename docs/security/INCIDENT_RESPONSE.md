# Incident Response (§102, §85)

Contact: `security@yourdomain` (set before launch).

## Playbooks (never expose secret values during investigation)

### Compromised API
1. Rotate `DATABASE_URL`, R2 credentials, signing keys.
2. Revoke all `Bearer` tokens (`store.revokeToken`), force `POST /v1/auth/refresh` failure.
3. Deploy patched `apps/api` via `release.yml` (signed artifact).

### Compromised DB
- DB holds **metadata only** (no plaintext). Rotate credentials, restore from PITR backup (RPO 24h, RTO 4h per §101), verify `cipherAlgorithm` integrity.

### Compromised R2 / Object Storage
- R2 holds **ciphertext** only. Rotate `R2_ACCESS_KEY_ID`, no public bucket, signed URLs expire 900s. Re-encrypt with new `keyVersion` if needed.

### Compromised signing key / CLI release
- Revoke `NPM_TOKEN`, bump `MAJOR`, `cosign` verify, `pnpm audit` block.

### Authentication breach / revoked device
- `DELETE /v1/auth/devices/:id`, `store.revokeDevice`, client `logout` clears `0600` fallback.

### Accidental secret exposure (log)
- Redact via `app.setErrorHandler` / `process.on(unhandledRejection)`, rotate affected env, `backup` new version.

## Runbooks
- `infra/docker/docker-compose.yml` for local reproduction.
- `pnpm -r typecheck && pnpm exec vitest run` before deploy.
- Backups: daily `pg_dump` encrypted, tested restore per §100 (“a backup never restored is not proven”).
