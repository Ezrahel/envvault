# EnvVault CLI — Usage (§4, §34, §58-60, §122)

`envvault` is the core product (not the dashboard, §113). All commands respect `EXIT_CODES` (§58): `0 success, 1 general, 2 args, 3 auth, 4 project not found, 5 env not found, 6 conflict, 7 network, 8 decryption`.

## Install

```bash
npm install -g envvault  # or pnpm --filter envvault build → node packages/cli/dist/index.js
envvault --help
```

## Config (§59-60)

- `ENVVAULT_API_URL` > `~/.config/envvault/config.json` `apiUrl` > `http://localhost:3001`
- `ENVVAULT_CONFIG_DIR` overrides OS: Linux `~/.config/envvault`, macOS `~/Library/Application Support/EnvVault`, Windows `%APPDATA%/EnvVault`
- `ENVVAULT_LOG_LEVEL` (default `info`), `ENVVAULT_CONFIG_DIR` for tests.

```bash
envvault init  # creates config, prints scan roots ~/Projects, ~/Development, ~/Code, ~/Work
cat ~/.config/envvault/config.json
```

## Auth (§25-26, §51)

```bash
envvault login --email you@example.com        # mock, tries API → fallback local 0600 auth.json
envvault login --github --email you@example.com # GitHub OAuth (least privilege, repo verification future)
envvault logout                                # clears auth.json, revokes token
# Credentials: OS keychain (future) or 0600 fallback with warning
```

`auth.json`: `{email, token, userId, deviceId, masterKey}` — `masterKey` is encryption secret (≠ auth token) per §25.

## Discovery (§7, §17-20, §35-36)

```bash
envvault scan                          # scans cfg.scan.roots
envvault scan --path ~/Projects        # single root
envvault scan --follow-symlinks        # off by default (§19), visited set prevents loops
envvault scan --json                   # machine-readable

# Output:
# ✓ /home/user/projects/<repository>/.env  Git: github.com/<username>/<repository>
# 3 repositories  3 environment files
# Duplicate canonical → lists both paths for user choice
```

Ignores `node_modules/.git/vendor/target/dist/build/.cache` (§18), graceful `EACCES` skip (no sudo, §20).

## Per-Repo (§38-41, §104)

```bash
cd <repository>  # must be inside git repo (finds nearest .git, worktree file supported)
envvault status                          # Git remote → canonical, env files present
envvault push --yes                      # checkbox select (or --all/--yes) → encrypt AAD=canonical → upload ciphertext → ✓ backed up
envvault pull --yes                      # list remote versions → select → decrypt → atomic 0600 (or --force backup)
envvault pull --path /other/repo --force
```

Never silently overwrites: `already exists → Skip/Backup/Overwrite/Diff` (default Skip, §40). Atomic `tmp 0600, fsync, rename` (§41).

## Migration (multi-repo, §84, §64, §66)

```bash
# Old laptop
envvault backup --dry-run                # preview 2 repos 4 files
envvault backup --yes                    # scan all roots → push all

# New laptop (different username/folder, same git remotes)
git clone git@github.com:acme/app1.git ~/Work/app1
git clone git@github.com:acme/app2.git ~/Code/app2
envvault restore --yes                   # inside single repo → restores that repo
envvault restore --path ~/Work --yes     # from parent → findAllGitRepos → restores all
envvault restore-all --path ~/Projects   # only missing (existing untouched, --force to overwrite) (§66)
envvault watch --path ~/Projects --yes   # fs.watch recursive, 1s debounce, never auto without --yes (§63)
```

## Utilities (§46-47)

```bash
envvault diff --file .env                # Added +D / Removed -B / Unchanged 1, values hidden, .env.example check (§45)
envvault versions --file .env            # table v2 ← latest, v1 + cipher, --json
envvault env list --path .               # list envs for repo (via API or vault)
```

## Projects (§8, §11-12)

```bash
envvault projects                        # GET /v1/projects (scoped to user)
```

Never uses folder name or local username; `github.com/<username>/<repository>` vs `github.com/john/<repository>` are distinct (fork handling §12).

## Exit Codes (§58) & Offline (§95)

- `scan/status` work offline; `push/pull/backup/restore` need net else local vault fallback.
- `Ctrl+C` cleans `.tmp` per §94.
