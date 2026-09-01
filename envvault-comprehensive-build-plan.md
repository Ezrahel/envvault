# EnvVault — Comprehensive Build Plan

## 1. Product Definition

### Working name
**EnvVault**

### One-line description
A developer-first, project-aware secrets backup and restoration platform that securely discovers local `.env*` files, associates them with Git repositories rather than local folder names, encrypts secrets client-side, stores encrypted backups in the cloud, and restores the correct environment automatically after a machine migration.

### Core problem

Developers frequently have many projects containing:

- `.env`
- `.env.local`
- `.env.development`
- `.env.staging`
- `.env.production`
- framework-specific environment files

These files are intentionally excluded from Git repositories because they contain secrets and machine-specific configuration.

When moving to a new laptop, developers clone their repositories but must manually remember and reconstruct environment files.

EnvVault solves:

```text
OLD MACHINE
  ↓
discover environment files
  ↓
identify Git repository
  ↓
associate environment with repository
  ↓
encrypt locally
  ↓
upload encrypted backup

NEW MACHINE
  ↓
clone Git repository
  ↓
envvault pull
  ↓
identify Git repository
  ↓
find matching encrypted environment
  ↓
decrypt locally
  ↓
restore .env file
```

---

# 2. Product Principles

1. **Never identify a project by its local folder name.**
2. **Git repository identity is the primary project identity.**
3. **Secrets are encrypted before leaving the user's machine.**
4. **The server should not need plaintext environment values.**
5. **Do not require sudo/root privileges for normal operations.**
6. **Never silently overwrite an existing environment file.**
7. **Every destructive or sensitive operation requires explicit confirmation.**
8. **The CLI should work offline where possible.**
9. **The web dashboard manages metadata and access, not plaintext secrets.**
10. **Security takes priority over convenience.**
11. **The product must support multiple local copies of the same repository.**
12. **The product must support different local usernames and folder structures.**
13. **The architecture must support GitHub first, while leaving room for GitLab, Bitbucket, and self-hosted Git later.**

---

# 3. Initial Target User

Primary user:

> Individual software developers with multiple repositories who frequently switch computers, reinstall operating systems, or maintain development environments across machines.

Secondary users:

- Freelancers
- DevOps engineers
- Full-stack developers
- Software teams
- Development agencies
- Technical students
- Startup engineering teams

Do not start by targeting large enterprises. Enterprise secrets management is a much larger security/compliance product category.

---

# 4. MVP Scope

## Must Have

### CLI

```bash
envvault login
envvault logout

envvault scan
envvault projects
envvault status

envvault push
envvault pull

envvault env list
envvault env push
envvault env pull

envvault init
```

### Discovery

Detect:

```text
.env
.env.local
.env.development
.env.test
.env.staging
.env.production
.env.*
```

while excluding obvious non-environment files such as:

```text
.env.example
.env.sample
.env.template
```

unless explicitly configured.

### Git detection

Find the nearest Git repository root.

Read:

```bash
git remote get-url origin
```

Normalize the remote URL.

Example:

```text
git@github.com:<username>/<repository>.git
```

becomes:

```text
github.com/<username>/<repository>
```

### Cloud

Store:

- project metadata
- environment metadata
- encrypted secret payload
- versions
- timestamps
- device information
- audit events

### Restoration

From:

```bash
cd <repository>
envvault pull
```

automatically identify:

```text
github.com/<username>/<repository>
```

and restore the matching environment.

---

# 5. Explicit Non-Goals for MVP

Do not initially build:

- Full enterprise secrets management
- Kubernetes secrets integration
- Automatic production deployment
- GitHub Actions marketplace integration
- Automatic secret rotation
- Cloud provider credential management
- Browser password management
- Arbitrary file backup
- Automatic deletion of local secrets
- Automatic uploading without user consent
- Plaintext server-side secret processing

These can come later.

---

# 6. User Experience

## First installation

```bash
npm install -g envvault
```

or eventually:

```bash
brew install envvault
```

or platform-native installers.

Then:

```bash
envvault login
```

Browser authentication:

```text
Open browser to authenticate EnvVault.
```

After authentication:

```text
✓ Authentication successful
✓ Device registered
```

---

# 7. Scanning

Command:

```bash
envvault scan
```

Example:

```text
Scanning configured directories...

✓ /home/user/projects/<repository>/.env
  Git: github.com/<username>/<repository>

✓ /home/user/projects/aorahq/.env.local
  Git: github.com/<username>/aorahq

✓ /home/user/client/crowdfunding/.env
  Git: github.com/<username>/crowdfunding

3 repositories
3 environment files
```

If the same repository exists in multiple locations:

```text
Repository:
github.com/<username>/<repository>

Found:
  /home/user/projects/<repository>/.env
  /home/user/backup/<repository>/.env
```

The UI should ask whether these represent:

- same environment
- different environment
- duplicate copy
- ignore

---

# 8. Project Identity

## Critical design decision

Never use:

```text
/home/user/projects/<repository>
```

as the project's identity.

Never use:

```text
<repository>
```

as the project's identity.

Never use the operating system username.

Instead:

```text
Git remote → canonical repository identity → EnvVault project ID
```

---

# 9. Git Identity Algorithm

## Step 1

Given:

```text
/home/user/projects/<repository>/.env
```

start at:

```text
/home/user/projects/<repository>
```

## Step 2

Walk upward until:

```text
.git/
```

is found.

## Step 3

Read the repository remote.

Equivalent command:

```bash
git remote get-url origin
```

## Step 4

Normalize.

Examples:

```text
git@github.com:<username>/<repository>.git
https://github.com/<username>/<repository>.git
https://github.com/<username>/<repository>
```

all become:

```text
github.com/<username>/<repository>
```

## Step 5

Store the normalized repository reference.

## Step 6

Map it to an internal EnvVault UUID.

Example:

```text
EnvVault Project ID:
01JXXXXXXXXXXXXXXX
```

The internal UUID should be the stable database identifier.

---

# 10. Git Remote Normalization

Create:

```text
packages/git/src/normalizeRemote.ts
```

Conceptual API:

```ts
export interface GitRepositoryIdentity {
  provider: "github" | "gitlab" | "bitbucket" | "unknown";
  host: string;
  owner?: string;
  repository: string;
  canonicalUrl: string;
}
```

Examples:

```text
git@github.com:<username>/<repository>.git
→ github.com/<username>/<repository>

ssh://git@github.com/<username>/<repository>.git
→ github.com/<username>/<repository>

https://github.com/<username>/<repository>.git
→ github.com/<username>/<repository>
```

Strip:

- `.git`
- protocol
- SSH username
- trailing slash

Preserve:

- host
- owner/group path
- repository name

Do not assume every Git host has GitHub-style `owner/repository` semantics.

---

# 11. GitHub Username vs Local Username

Example:

```text
Local machine:

/home/john/projects/<repository>
```

GitHub:

```text
github.com/<username>/<repository>
```

EnvVault must associate the environment with:

```text
github.com/<username>/<repository>
```

not:

```text
john
```

and not:

```text
/home/john/projects/<repository>
```

On another machine:

```text
/home/mary/dev/my-pdf-project
```

with the same Git remote:

```text
github.com/<username>/<repository>
```

must resolve to the same EnvVault project.

---

# 12. Fork Handling

These are different:

```text
github.com/<username>/<repository>
github.com/john/<repository>
```

They must not automatically share secrets.

Full canonical remote identity prevents accidental collision.

---

# 13. Git Remote Changes

A repository can change its remote.

Example:

```text
old:
github.com/<username>/<repository>

new:
github.com/company/<repository>
```

Treat the new remote as a new project identity unless the user explicitly links the projects.

Provide:

```bash
envvault project link
```

later for intentional migration.

Never automatically merge secrets merely because repository names match.

---

# 14. Branches vs Environments

Do not automatically equate:

```text
main = production
develop = development
```

Instead model:

```text
Project
  ├── development
  ├── test
  ├── staging
  └── production
```

Optionally allow:

```text
main → production
develop → development
```

as user-configured mappings.

---

# 15. Environment File Identity

An environment file needs its own identity.

Recommended:

```text
project_id
environment_name
file_name
```

Example:

```text
project:
github.com/<username>/<repository>

environment:
development

file:
.env.local
```

Do not infer environment semantics purely from filename forever. Allow custom names.

---

# 16. Environment File Classification

Initial defaults:

```text
.env                  → default
.env.local            → local
.env.development      → development
.env.test             → test
.env.staging           → staging
.env.production       → production
```

Allow users to override classification.

Example:

```bash
envvault env rename .env.local development
```

---

# 17. File Discovery

The scanner should support configured roots:

```text
~/Projects
~/Development
~/Code
~/Work
```

Do not blindly scan the entire filesystem by default.

Reasons:

- performance
- privacy
- permission errors
- accidental discovery of unrelated secrets
- system directories
- mounted drives
- huge node_modules trees

Provide:

```bash
envvault scan --path ~/Projects
```

and configuration:

```yaml
scan:
  roots:
    - ~/Projects
    - ~/Development
```

---

# 18. Ignore Rules

Ignore:

```text
.git/
node_modules/
vendor/
target/
dist/
build/
.cache/
```

and user-configurable directories.

Allow:

```text
.env
.env.local
.env.development
.env.production
```

Do not read the contents of files merely to identify them.

Discovery should first use metadata/path information.

---

# 19. Symlink Handling

Be conservative.

Avoid following symlinks by default.

Provide:

```bash
envvault scan --follow-symlinks
```

only if explicitly enabled.

Prevent recursive loops.

---

# 20. Permissions

The scanner may encounter:

```text
Permission denied
```

Do not recommend sudo as the default solution.

Instead:

```text
⚠ Skipped /restricted/path
  Reason: permission denied
```

Provide an explicit opt-in mechanism if the user knows what they are doing.

---

# 21. Security Architecture

## Most important requirement

Secrets must be encrypted client-side.

Desired flow:

```text
.env plaintext
     ↓
local encryption
     ↓
ciphertext
     ↓
HTTPS
     ↓
API
     ↓
object storage/database
```

The server should store ciphertext, not plaintext environment variables.

---

# 22. Encryption Model

Use well-reviewed cryptographic primitives rather than implementing cryptography yourself.

Recommended initial design:

- AES-256-GCM or another authenticated encryption construction
- random nonce/IV per encrypted object
- authenticated metadata / associated data
- cryptographically secure random keys
- secure key derivation
- key versioning

Do not invent a custom encryption algorithm.

---

# 23. Key Management

A practical architecture:

```text
User master secret
        ↓
Key derivation
        ↓
encryption key
        ↓
encrypt environment
```

The server receives:

```text
ciphertext
metadata
version
nonce
authentication tag
```

The server should not receive the user's master encryption secret.

However, account recovery becomes difficult.

This is a deliberate tradeoff.

---

# 24. Recovery Model

Possible modes:

### Mode A — Maximum privacy

User controls the encryption key.

If the key is lost:

```text
secrets cannot be recovered
```

### Mode B — Account recovery

Use a recovery mechanism involving encrypted key material and carefully designed key wrapping.

### Mode C — Team-managed recovery

Introduce organization recovery keys later.

For MVP, clearly communicate the recovery model instead of pretending the server can magically recover client-side encrypted secrets.

---

# 25. Authentication vs Encryption

Do not confuse:

```text
authentication
```

with:

```text
encryption key
```

A user can authenticate to EnvVault while the server still cannot decrypt their secrets.

Example:

```text
OAuth / email login
        ↓
API access token
```

is separate from:

```text
local encryption key
```

---

# 26. Local Credential Storage

Never store long-lived credentials in:

```text
.env
```

or plaintext config files.

Use the operating system's secure credential store where practical:

- macOS Keychain
- Windows Credential Manager
- Linux Secret Service / keyring

Provide a fallback with clear security warnings if a platform does not have a usable secure store.

---

# 27. CLI Technology

Use:

```text
TypeScript
Node.js
```

Recommended tooling:

- TypeScript
- Node.js
- pnpm
- tsup or equivalent bundler
- Vitest
- ESLint
- Prettier

CLI framework options:

- Commander
- Yargs
- Oclif

Prefer a mature CLI framework with strong TypeScript support.

---

# 28. Monorepo

Recommended:

```text
pnpm workspace
```

Structure:

```text
envvault/
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── cli/
│   ├── crypto/
│   ├── git/
│   ├── env-parser/
│   ├── shared/
│   ├── config/
│   └── sdk/
│
├── infra/
├── docs/
├── scripts/
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

# 29. Recommended Stack

## Frontend

Choose one:

```text
Next.js + TypeScript
```

or:

```text
React + Vite + TypeScript
```

For a dashboard, Next.js is a strong default.

## API

Recommended:

```text
TypeScript
Fastify
```

Alternative:

```text
NestJS
```

Fastify is a good choice if you want a lightweight API.

## Database

Use:

```text
PostgreSQL
```

## ORM

Use one:

```text
Drizzle ORM
```

or:

```text
Prisma
```

Drizzle is a good fit if you prefer explicit SQL-oriented TypeScript.

## Object storage

Use S3-compatible storage:

```text
Cloudflare R2
```

or another S3-compatible provider.

The object contains encrypted ciphertext.

## Authentication

Start with:

- email/password + secure sessions, or
- OAuth providers

Add GitHub OAuth because Git repository association is central to the product.

---

# 30. High-Level Architecture

```text
                  ┌────────────────────┐
                  │      Web App       │
                  │  Next.js + TS      │
                  └─────────┬──────────┘
                            │
                            │ HTTPS
                            ▼
                  ┌────────────────────┐
                  │      API           │
                  │ Fastify + TS       │
                  └───────┬─────┬──────┘
                          │     │
                  ┌───────┘     └──────────┐
                  ▼                         ▼
          ┌───────────────┐        ┌───────────────┐
          │ PostgreSQL    │        │ Object Store  │
          │ metadata      │        │ ciphertext    │
          └───────────────┘        └───────────────┘

                         ▲
                         │ HTTPS
                         │
                  ┌──────┴───────┐
                  │ EnvVault CLI │
                  │ TypeScript   │
                  └──────────────┘
                         ▲
                         │
                local encryption
                         ▲
                         │
                       .env
```

---

# 31. Database Schema

## users

```text
id
email
name
avatar_url
created_at
updated_at
```

## projects

```text
id
user_id
provider
host
owner
repository
canonical_remote
created_at
updated_at
```

Unique constraint:

```text
(user_id, canonical_remote)
```

Potentially support organization/team ownership later.

## environments

```text
id
project_id
name
created_at
updated_at
```

## environment_files

```text
id
environment_id
file_name
created_at
updated_at
```

## secret_versions

```text
id
environment_file_id
version
object_key
cipher_algorithm
key_version
nonce
created_at
created_by
```

Do not store plaintext variables.

## devices

```text
id
user_id
name
platform
last_seen_at
created_at
revoked_at
```

## audit_logs

```text
id
user_id
project_id
action
device_id
ip_hash_or_safe_metadata
created_at
```

Be careful about logging sensitive information.

Never log:

- secret values
- encryption keys
- full environment contents

---

# 32. API Design

## Authentication

```http
POST /v1/auth/login
POST /v1/auth/logout
POST /v1/auth/refresh
```

## Projects

```http
GET /v1/projects
POST /v1/projects
GET /v1/projects/:id
DELETE /v1/projects/:id
```

## Environments

```http
GET /v1/projects/:id/environments
POST /v1/projects/:id/environments
```

## Environment files

```http
GET /v1/environments/:id/files
POST /v1/environments/:id/files
```

## Encrypted payloads

```http
POST /v1/environment-files/:id/versions
GET /v1/environment-files/:id/versions
GET /v1/environment-files/:id/versions/:version
```

Prefer signed object-storage URLs for large ciphertext payloads rather than proxying every byte through the API.

---

# 33. API Payload Example

Client uploads:

```json
{
  "project": {
    "provider": "github",
    "host": "github.com",
    "owner": "<username>",
    "repository": "<repository>",
    "canonicalRemote": "github.com/<username>/<repository>"
  },
  "environment": {
    "name": "development",
    "fileName": ".env.local"
  },
  "encryption": {
    "algorithm": "AES-256-GCM",
    "keyVersion": 1,
    "nonce": "..."
  },
  "ciphertext": "..."
}
```

The exact crypto envelope should be defined and versioned before production.

---

# 34. CLI Architecture

```text
packages/cli/
├── src/
│   ├── commands/
│   │   ├── login.ts
│   │   ├── logout.ts
│   │   ├── scan.ts
│   │   ├── push.ts
│   │   ├── pull.ts
│   │   ├── projects.ts
│   │   └── status.ts
│   │
│   ├── git/
│   ├── scanner/
│   ├── crypto/
│   ├── auth/
│   ├── api/
│   ├── storage/
│   ├── config/
│   └── index.ts
```

Keep CLI presentation separate from business logic.

---

# 35. Project Detection Algorithm

Pseudo-flow:

```text
function identifyProject(startPath):

    current = startPath

    while current is not filesystem root:

        if current/.git exists:

            remote = readGitOrigin(current)

            if remote exists:
                return normalizeRemote(remote)

        current = parent(current)

    return NOT_A_GIT_PROJECT
```

Important:

`.git` may be a file rather than a directory for Git worktrees.

Support both.

---

# 36. Worktree Support

Git worktrees can have:

```text
.git
```

as a file.

Do not assume:

```text
.git/
```

is always a directory.

Resolve the actual Git common directory when necessary.

---

# 37. Multiple Remotes

A project may have:

```text
origin
upstream
```

Prefer:

```text
origin
```

by default.

If origin does not exist:

```text
upstream
```

can be considered.

If multiple plausible repositories exist, show the user:

```text
Multiple Git remotes detected.

1. github.com/<username>/<repository>
2. github.com/company/<repository>

Select project identity.
```

Never guess when ambiguity matters.

---

# 38. `envvault push`

Expected flow:

```text
$ envvault push

Repository:
github.com/<username>/<repository>

Detected environments:

1. .env.local
2. .env.production

Select:
[1] .env.local
[2] .env.production
[3] all
```

Then:

```text
Encrypting locally...
Uploading ciphertext...
✓ .env.local backed up
✓ .env.production backed up
```

---

# 39. `envvault pull`

From inside a Git project:

```bash
envvault pull
```

Flow:

```text
Detect Git repository
       ↓
Canonicalize remote
       ↓
Authenticate
       ↓
Find EnvVault project
       ↓
List environments
       ↓
Select target
       ↓
Check local file
       ↓
Download ciphertext
       ↓
Decrypt locally
       ↓
Write safely
```

---

# 40. Never Overwrite Automatically

If:

```text
.env.local
```

already exists:

```text
⚠ .env.local already exists.

Options:

[1] Abort
[2] Backup existing file then restore
[3] Overwrite
[4] Diff
```

Default:

```text
Abort
```

---

# 41. Atomic File Restoration

Never write directly into the final file.

Use:

```text
.env.local.envvault.tmp
```

then:

```text
fsync
rename
```

This prevents partially written secrets if the process crashes.

Set restrictive permissions where supported.

For Unix systems, newly created secret files should generally be owner-readable/writable only.

---

# 42. Backup Existing Files

Before overwriting:

```text
.env.local
```

could become:

```text
.env.local.envvault-backup-2026-08-31
```

But avoid creating endless backups.

Provide retention settings.

---

# 43. Secret Exposure Prevention

The CLI must never print:

```text
DATABASE_URL=...
JWT_SECRET=...
```

to stdout.

Do not include secret values in:

- logs
- error messages
- analytics
- telemetry
- crash reports
- shell history

Be careful with command arguments because shell history can expose secrets.

---

# 44. Telemetry

If telemetry is introduced:

Never collect:

- environment contents
- secret names unless explicitly needed
- secret values
- repository private data
- tokens

Prefer anonymous operational metrics:

```text
CLI version
OS family
command success/failure
duration
error category
```

Make telemetry opt-out or privacy-preserving depending on product/legal requirements.

---

# 45. `.env.example` Integration

EnvVault can detect:

```text
.env.example
```

and compare variable names.

Example:

```text
.env.example:
DATABASE_URL=
JWT_SECRET=
PAYSTACK_SECRET_KEY=
```

Restored `.env`:

```text
DATABASE_URL
JWT_SECRET
PAYSTACK_SECRET_KEY
```

CLI could eventually report:

```text
✓ 3/3 expected variables present
```

Do not display their values.

This should be a post-MVP feature.

---

# 46. Secret Diffing

Future command:

```bash
envvault diff
```

Output:

```text
Environment: development

Added:
  REDIS_URL

Removed:
  OLD_API_KEY

Changed:
  DATABASE_URL

Values are intentionally hidden.
```

Never display secret values by default.

---

# 47. Versioning

Every upload should create a version.

Example:

```text
v1
v2
v3
```

Support:

```bash
envvault versions
```

and eventually:

```bash
envvault restore --version 2
```

This is extremely useful when a developer accidentally breaks an environment.

---

# 48. Deletion

Deletion should be explicit:

```bash
envvault env delete production
```

Require confirmation:

```text
This will permanently remove encrypted environment versions.

Type:
DELETE
```

Eventually implement configurable retention and secure object deletion.

---

# 49. Team Support — Post MVP

Model ownership separately from personal projects.

Future:

```text
User
 └── Organization
      └── Project
           └── Environment
```

Roles:

```text
Owner
Admin
Developer
Viewer
```

Do not give every team member automatic access to production secrets.

---

# 50. Organization Security

Future features:

- RBAC
- SSO
- MFA
- audit logs
- recovery keys
- approval workflows
- environment-level permissions
- IP restrictions
- session controls

These should not complicate the initial individual-developer MVP.

---

# 51. GitHub Integration

GitHub integration should initially be used for:

1. OAuth authentication
2. repository identity
3. optional repository verification

Do not request unnecessary GitHub permissions.

Prefer least privilege.

For private repository access, clearly explain why a permission is requested.

---

# 52. Repository Verification

A repository identity from:

```text
git remote
```

is not automatically proof that the user owns the repository.

For MVP, authenticated user ownership and access can be handled through the EnvVault account.

Later, verify repository access through GitHub API where appropriate.

Never rely solely on a user-controlled string such as:

```text
github.com/admin/production-secrets
```

for authorization.

---

# 53. Security Threat Model

Threats to consider:

### Stolen laptop

Attacker gets local CLI credentials.

Mitigation:

- OS credential store
- session expiration
- device revocation
- encrypted local state
- optional MFA

### Compromised server

Attacker accesses database/object storage.

Goal:

```text
ciphertext only
```

so secrets remain protected by client-side encryption.

### Malicious CLI update

A compromised CLI could access plaintext before encryption.

Mitigation:

- signed releases
- reproducible builds where practical
- package integrity
- release security
- minimal dependencies

### Malicious repository

A repository could contain scripts that attempt to steal credentials.

Important:

Do not automatically execute project code during:

```bash
envvault pull
```

Do not run:

```text
npm install
```

or:

```text
make
```

or arbitrary hooks.

### Secret leakage through logs

Prevent plaintext logging.

### Secret leakage through crash reporting

Sanitize errors.

### Cross-account project collision

Always scope project lookups to the authenticated user or organization.

---

# 54. Dependency Security

Use:

```bash
pnpm audit
```

and automated dependency scanning.

Recommended:

- Dependabot/Renovate
- GitHub security alerts
- lockfile enforcement
- minimal dependencies

Do not install an obscure crypto library when platform/Web Crypto primitives or well-reviewed libraries are available.

---

# 55. Testing Strategy

## Unit tests

Test:

- Git URL normalization
- project detection
- environment classification
- ignore rules
- encryption/decryption
- config parsing
- CLI argument validation

## Integration tests

Test:

```text
scan → identify → encrypt → upload → download → decrypt → restore
```

## End-to-end tests

Use a real temporary Git repository:

```text
temp/
└── <repository>/
    ├── .git/
    └── .env
```

Set remote:

```text
github.com/test/<repository>
```

Run:

```bash
envvault push
```

then clone into another directory and:

```bash
envvault pull
```

Verify exact file contents.

---

# 56. Cryptography Tests

Test:

```text
encrypt(data) → ciphertext
decrypt(ciphertext) → original data
```

Test failure cases:

- wrong key
- modified ciphertext
- modified nonce
- modified authentication tag
- corrupted payload
- unsupported crypto version

Tampering must fail safely.

---

# 57. Cross-Platform Testing

Support initially:

```text
Linux
macOS
Windows
```

Test:

- filesystem paths
- permissions
- Git installation detection
- keychain integration
- path separators
- shell behavior

Do not assume `/home/user`.

Do not assume `/`.

Do not assume bash exists on Windows.

---

# 58. CLI Exit Codes

Define stable exit codes.

Example:

```text
0 = success
1 = general error
2 = invalid arguments
3 = authentication failure
4 = project not found
5 = environment not found
6 = local conflict
7 = network error
8 = decryption failure
```

Document them.

---

# 59. Configuration

Possible location:

Linux:

```text
~/.config/envvault/config.json
```

macOS:

```text
~/Library/Application Support/EnvVault/
```

Windows:

```text
%APPDATA%/EnvVault/
```

Do not store plaintext secrets in configuration.

---

# 60. Environment Variables for CLI

Possible non-secret configuration:

```text
ENVVAULT_API_URL
ENVVAULT_CONFIG_DIR
ENVVAULT_LOG_LEVEL
```

Do not encourage:

```text
ENVVAULT_MASTER_KEY
```

as a normal workflow because shell environments can leak credentials.

---

# 61. Local State

Store:

```text
current account
device ID
API session/token reference
configuration
project mappings
```

Keep encryption secrets separate and protected by the OS credential store where possible.

---

# 62. Project Mapping Cache

The CLI may maintain:

```text
canonicalRemote → EnvVault project ID
```

locally for faster operation.

Example:

```json
{
  "github.com/<username>/<repository>": "01J..."
}
```

This cache is metadata, not secret data.

---

# 63. Automatic Mode

Later:

```bash
envvault watch
```

The watcher monitors configured roots.

When:

```text
new .env
```

is detected:

```text
New environment file detected.

Project:
github.com/<username>/<repository>

File:
.env.local

Back up now? [y/N]
```

Never upload automatically without explicit opt-in.

---

# 64. Migration Mode

A killer UX feature:

```bash
envvault migrate
```

Output:

```text
Preparing development environment migration...

Repositories found: 27
Environment files found: 43

43 files will be encrypted and backed up.

Continue? [y/N]
```

Then:

```text
✓ 43/43 encrypted
✓ 43/43 uploaded

Migration backup complete.
```

On new machine:

```bash
envvault restore
```

could restore everything associated with detected repositories.

This should come after the MVP.

---

# 65. New Laptop Workflow

Recommended documentation:

```text
1. Install EnvVault
2. Login
3. Clone repositories
4. cd into repository
5. envvault pull
6. Run project
```

Example:

```bash
git clone git@github.com:<username>/<repository>.git
cd <repository>
envvault pull
npm install
npm run dev
```

EnvVault should never need to know the local username.

---

# 66. "Restore All" Feature

Later:

```bash
envvault restore-all ~/Projects
```

Algorithm:

```text
scan directory
    ↓
find Git repositories
    ↓
identify remotes
    ↓
match EnvVault projects
    ↓
restore only missing environments
```

Existing files should remain untouched unless explicitly requested.

---

# 67. Server Storage Strategy

Metadata:

```text
PostgreSQL
```

Ciphertext:

```text
S3/R2 object storage
```

Example object key:

```text
users/{userId}/projects/{projectId}/environments/{environmentId}/versions/{versionId}
```

Do not place secret values in object names.

---

# 68. Object Storage Security

Configure:

- private buckets
- no public access
- encryption at rest
- lifecycle policies
- versioning where useful
- short-lived signed URLs
- access logging where appropriate

The application should never generate public URLs for secret objects.

---

# 69. API Authorization

Every request must verify:

```text
authenticated user
        ↓
owns project / has permission
        ↓
owns environment / has permission
        ↓
can access requested version
```

Never trust:

```text
projectId
environmentId
```

from the client without authorization checks.

---

# 70. Rate Limiting

Rate-limit:

```text
login
refresh
project creation
uploads
downloads
delete
```

Use sensible limits.

Be careful not to make legitimate bulk migration impossible.

Provide authenticated higher limits for migration operations.

---

# 71. API Validation

Use a schema validation library such as:

```text
Zod
```

Validate:

- request bodies
- query parameters
- route parameters
- API responses where useful

Never trust client-supplied metadata.

---

# 72. Error Handling

Never return:

```text
DATABASE_URL=...
```

in an exception.

Bad:

```text
Failed to decrypt DATABASE_URL=postgres://...
```

Good:

```text
Failed to decrypt environment payload.
```

Use internal error IDs for debugging.

---

# 73. Logging

Structured logs:

```json
{
  "requestId": "...",
  "event": "environment.restore",
  "status": "success"
}
```

Never:

```json
{
  "env": {
    "DATABASE_URL": "..."
  }
}
```

---

# 74. Observability

Production:

- structured logs
- metrics
- uptime monitoring
- API latency
- database performance
- object storage errors
- authentication failures
- CLI error telemetry if enabled

Monitor:

```text
API p50
API p95
API p99
5xx rate
upload failure rate
restore failure rate
authentication failure rate
```

---

# 75. CI/CD

GitHub Actions pipeline:

```text
Pull Request
   ↓
lint
   ↓
typecheck
   ↓
unit tests
   ↓
integration tests
   ↓
build
```

Main branch:

```text
test
 ↓
build
 ↓
security scan
 ↓
deploy staging
 ↓
smoke tests
 ↓
production
```

---

# 76. Release Pipeline

CLI release:

```text
tag version
   ↓
CI build
   ↓
test
   ↓
package
   ↓
sign artifacts
   ↓
publish npm package
   ↓
generate release
```

Eventually distribute binaries through:

- npm
- Homebrew
- Windows installer
- Linux packages

---

# 77. Semantic Versioning

Use:

```text
MAJOR.MINOR.PATCH
```

Example:

```text
0.1.0
0.2.0
1.0.0
```

Do not break stored encryption formats casually.

Crypto/storage format compatibility must be explicitly versioned.

---

# 78. Migration Strategy for Encryption Formats

Every encrypted payload should carry:

```text
formatVersion
algorithm
keyVersion
nonce
ciphertext
```

Example:

```json
{
  "formatVersion": 1,
  "algorithm": "AES-256-GCM",
  "keyVersion": 1,
  "nonce": "...",
  "ciphertext": "..."
}
```

Future versions can coexist.

---

# 79. Development Phases

## Phase 0 — Research

Tasks:

- analyze competing secrets-management products
- validate developer pain
- interview developers
- test naming
- define threat model
- choose crypto architecture
- define recovery model

Deliverables:

```text
PRD
Threat Model
Architecture Decision Records
Crypto Design
CLI UX specification
```

---

# 80. Phase 1 — Local CLI Prototype

Build without cloud.

Commands:

```bash
envvault scan
envvault status
```

Features:

- scan configured paths
- detect `.env*`
- detect Git root
- read Git remote
- normalize remote
- classify environment
- display results

No uploading yet.

Goal:

> Prove project discovery works reliably.

---

# 81. Phase 2 — Local Encryption Prototype

Build:

```bash
envvault encrypt
envvault decrypt
```

Test:

```text
.env
 ↓
encrypt
 ↓
encrypted blob
 ↓
decrypt
 ↓
.env restored
```

No cloud yet.

Goal:

> Prove cryptographic envelope and recovery design.

---

# 82. Phase 3 — Backend

Build:

- authentication
- PostgreSQL
- projects
- environments
- versions
- object storage
- authorization

CLI:

```bash
envvault login
envvault push
envvault pull
```

Goal:

> Complete local-to-cloud-to-local round trip.

---

# 83. Phase 4 — Web Dashboard

Dashboard:

```text
Projects
Environments
Versions
Devices
Account
Security
```

Do not display plaintext secret values.

Possible metadata:

```text
.env.local
8 variables
Last updated 2 hours ago
```

Even variable names should be treated carefully because they can reveal sensitive architecture.

---

# 84. Phase 5 — Migration UX

Build:

```bash
envvault backup
envvault restore
```

Example:

```text
Old laptop:
envvault backup

New laptop:
envvault restore
```

Support multiple projects.

---

# 85. Phase 6 — Production Hardening

Before public launch:

- security audit
- dependency audit
- penetration test
- threat-model review
- backup/restore tests
- disaster recovery
- rate limiting
- abuse protection
- monitoring
- incident response plan
- privacy policy
- terms of service
- security documentation

---

# 86. Phase 7 — Public Launch

Start with:

```text
Free:
limited projects/storage

Pro:
unlimited or higher limits
version history
multiple devices
advanced migration

Team:
shared projects
RBAC
audit logs
```

Do not overcomplicate pricing before validating demand.

---

# 87. Suggested Repository Structure

```text
envvault/
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── cli/
│   ├── crypto/
│   ├── git/
│   ├── env-parser/
│   ├── config/
│   ├── database/
│   ├── api-client/
│   ├── shared/
│   └── ui/
│
├── tests/
│   ├── integration/
│   └── e2e/
│
├── infra/
│   ├── docker/
│   ├── terraform/
│   └── migrations/
│
├── docs/
│   ├── architecture/
│   ├── security/
│   ├── api/
│   └── cli/
│
├── scripts/
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
└── README.md
```

---

# 88. TypeScript Standards

Enable strict mode:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true
  }
}
```

Avoid:

```ts
any
```

unless justified.

Prefer explicit domain types.

---

# 89. Domain Types

Example:

```ts
export type GitProvider =
  | "github"
  | "gitlab"
  | "bitbucket"
  | "unknown";

export interface ProjectIdentity {
  provider: GitProvider;
  host: string;
  owner?: string;
  repository: string;
  canonicalRemote: string;
}
```

Environment:

```ts
export interface EnvironmentFile {
  fileName: string;
  environmentName: string;
  absolutePath: string;
  project: ProjectIdentity;
}
```

Do not allow crypto package types to leak throughout the entire application.

Create a stable crypto interface.

---

# 90. Crypto Interface

Example abstraction:

```ts
export interface EncryptedPayload {
  formatVersion: number;
  algorithm: string;
  keyVersion: number;
  nonce: string;
  ciphertext: string;
  authTag?: string;
}

export interface CryptoProvider {
  encrypt(
    plaintext: Uint8Array,
    associatedData?: Uint8Array,
  ): Promise<EncryptedPayload>;

  decrypt(
    payload: EncryptedPayload,
    associatedData?: Uint8Array,
  ): Promise<Uint8Array>;
}
```

The implementation can change without rewriting the CLI.

---

# 91. Git Service Interface

```ts
export interface GitService {
  findRepositoryRoot(path: string): Promise<string | null>;

  getOriginRemote(
    repositoryRoot: string,
  ): Promise<string | null>;

  getIdentity(
    repositoryRoot: string,
  ): Promise<ProjectIdentity | null>;
}
```

This makes testing easier.

---

# 92. Scanner Interface

```ts
export interface Scanner {
  scan(
    roots: string[],
    options?: ScanOptions,
  ): AsyncIterable<EnvironmentFile>;
}
```

Use async iteration for large scans.

Do not load thousands of results into memory unnecessarily.

---

# 93. Performance

Large developer machines may contain:

```text
hundreds of thousands of files
```

Optimize scanning.

Use:

- directory pruning
- ignored directories
- async filesystem APIs
- bounded concurrency
- cancellation
- progress reporting

Support:

```bash
envvault scan --path ~/Projects
```

instead of requiring a full-disk scan.

---

# 94. Cancellation

Support:

```text
Ctrl+C
```

cleanly.

Do not leave:

```text
.tmp
partial encrypted files
```

behind.

Cancel uploads and clean temporary resources.

---

# 95. Offline Behavior

Some commands should work offline:

```bash
envvault scan
envvault status
```

Cloud operations require connectivity:

```bash
envvault push
envvault pull
```

Potentially queue uploads later, but only with explicit opt-in.

---

# 96. Privacy

The product should clearly explain:

```text
EnvVault scans only directories configured by the user.
```

It should not silently scan:

```text
entire filesystem
```

by default.

Users should be able to inspect what was discovered before upload.

---

# 97. User Consent

Before first upload:

```text
EnvVault found:

12 projects
27 environment files

Secrets will be encrypted on this device before upload.

Continue? [y/N]
```

This is important for trust.

---

# 98. Security UX

Show:

```text
✓ Encrypted locally
✓ Uploaded encrypted payload
```

Do not claim:

```text
"100% secure"
```

or:

```text
"unhackable"
```

Use precise security language.

---

# 99. Production Infrastructure

Example:

```text
Cloudflare
   ↓
DNS / TLS / WAF
   ↓
API service
   ↓
PostgreSQL
   ↓
R2
```

Web app:

```text
CDN
 ↓
Next.js
```

Use environment-specific infrastructure:

```text
development
staging
production
```

Never share production database credentials with local development.

---

# 100. Database Backups

Production PostgreSQL:

- automated backups
- point-in-time recovery if available
- retention policy
- encrypted backups
- periodic restore tests

A backup that has never been restored is not proven.

---

# 101. Disaster Recovery

Document:

```text
RPO
RTO
```

Example initial goals:

```text
RPO: 24 hours
RTO: 4 hours
```

Improve as the product grows.

Test:

```text
database loss
object storage outage
API outage
credential compromise
deployment rollback
```

---

# 102. Incident Response

Prepare procedures for:

- compromised API
- compromised database
- compromised object storage
- compromised signing key
- malicious CLI release
- authentication breach
- accidental secret exposure

Have a security contact:

```text
security@yourdomain
```

Do not expose secret values during investigation.

---

# 103. Domain Model

The core relationship:

```text
User
 │
 ├── Devices
 │
 └── Projects
      │
      └── Environments
           │
           └── EnvironmentFiles
                │
                └── Versions
                     │
                     └── EncryptedPayload
```

Future:

```text
Organization
 └── Members
      └── Projects
```

---

# 104. Core Product Invariant

The most important invariant:

> A local project path is temporary. A Git repository identity is the stable project reference.

Example:

```text
Machine A:
/home/israel/projects/<repository>

Machine B:
/home/john/work/pdf

Machine C:
D:\Development\MyPDFUploader
```

All can map to:

```text
github.com/<username>/<repository>
```

and therefore:

```text
EnvVault Project ID: X
```

---

# 105. Important Edge Cases

Handle:

- no Git repository
- no remote
- multiple remotes
- renamed repository
- transferred repository
- fork
- Git worktree
- detached HEAD
- bare repository
- submodules
- nested Git repositories
- private repositories
- inaccessible directories
- symlinks
- duplicate environment files
- missing environment
- existing local environment
- corrupted encrypted payload
- expired authentication
- revoked device
- offline mode

---

# 106. Nested Repositories

Example:

```text
monorepo/
  .git/
  apps/
    frontend/
      .env
```

The environment belongs to:

```text
monorepo
```

unless `apps/frontend` has its own Git repository.

Algorithm:

> Use the nearest Git root.

---

# 107. Monorepo Support

Later, support multiple application environments within one repository.

Example:

```text
github.com/<username>/platform
```

contains:

```text
apps/web/.env
apps/api/.env
apps/worker/.env
```

Model:

```text
Project
 └── Workspace/Application
      └── Environment
```

Do not force every `.env` in a monorepo into one flat environment namespace.

---

# 108. Project Fingerprinting

Git remote should be primary.

A future secondary fingerprint can include:

```text
Git remote
Git repository UUID
Git common directory
optional package manifest
```

Do not use file contents as a secret fingerprint.

Do not hash entire repositories unnecessarily.

---

# 109. Repository Rename Handling

If:

```text
github.com/<username>/<repository>
```

becomes:

```text
github.com/<username>/pdf-vault
```

GitHub redirects may exist, but EnvVault should not silently rely on them forever.

Future GitHub integration can resolve repository IDs.

GitHub's stable repository ID can be a stronger provider-specific identity than the URL.

Store:

```text
provider
providerRepositoryId
canonicalRemote
```

when available.

This can make repository renames easier to handle.

---

# 110. Recommended Identity Model

Use:

```text
EnvVault internal project ID
        +
provider
        +
provider repository ID
        +
canonical remote
```

Priority:

```text
provider repository ID
        ↓
canonical remote
        ↓
explicit user mapping
```

This provides resilience when repository URLs change.

---

# 111. First Production Milestone

Production-ready MVP should support:

```text
✓ Account creation/login
✓ CLI authentication
✓ Secure local credential storage
✓ Git repository discovery
✓ Git remote normalization
✓ .env discovery
✓ Project association
✓ Client-side encryption
✓ Upload encrypted payload
✓ Download encrypted payload
✓ Local decryption
✓ Safe file restoration
✓ Version history
✓ Existing-file protection
✓ PostgreSQL
✓ Private object storage
✓ HTTPS
✓ Authorization
✓ Audit logging
✓ Rate limiting
✓ CI/CD
✓ Monitoring
✓ Backups
✓ Documentation
```

---

# 112. Definition of Done

The MVP is not done when:

```text
"envvault pull works on my laptop"
```

It is done when:

```text
Developer A
  ↓
backs up 20 projects
  ↓
old machine destroyed
  ↓
new machine
  ↓
clones projects into completely different directories
  ↓
envvault pull
  ↓
all expected environments restore correctly
```

and:

```text
server/database compromise
```

does not expose plaintext environment values.

---

# 113. Development Order

Recommended implementation sequence:

```text
1. Git identity engine
2. Environment scanner
3. CLI UX
4. Local encryption
5. Local restore
6. API
7. Database
8. Object storage
9. Authentication
10. Push/pull
11. Web dashboard
12. Versioning
13. Security hardening
14. CI/CD
15. Production deployment
16. Documentation
17. Public beta
```

Do not start with the dashboard.

The CLI is the actual product's core.

---

# 114. First Coding Sprint

Build:

```text
packages/git
packages/env-parser
packages/cli
```

Implement:

```bash
envvault scan
```

Expected:

```text
Scanning...

Project:
github.com/<username>/<repository>

Environment:
.env.local

Path:
/home/user/projects/<repository>/.env.local
```

Then test with:

```text
different OS username
different folder
same Git repository
```

The result must remain the same:

```text
github.com/<username>/<repository>
```

---

# 115. Second Coding Sprint

Implement local crypto:

```bash
envvault backup --local
envvault restore --local
```

Do not involve the cloud yet.

Test:

```text
.env
 ↓
encrypt
 ↓
delete original
 ↓
decrypt
 ↓
compare
```

Byte-for-byte verification should pass.

---

# 116. Third Coding Sprint

Implement backend:

```text
POST /projects
POST /environment-files
GET /projects
GET /environment-files
```

Then:

```bash
envvault push
envvault pull
```

Complete the end-to-end flow.

---

# 117. Fourth Coding Sprint

Add:

- authentication
- device management
- versioning
- safe restore
- conflict detection
- audit logs

---

# 118. Fifth Coding Sprint

Build web dashboard.

Dashboard should initially answer:

```text
What projects do I have?
What environments are backed up?
When were they last updated?
What devices have access?
```

Not:

```text
What are my secret values?
```

---

# 119. Production Checklist

## Security

- [ ] Threat model completed
- [ ] Crypto design reviewed
- [ ] Client-side encryption tested
- [ ] Authentication secured
- [ ] Authorization tested
- [ ] Secrets excluded from logs
- [ ] Private object storage
- [ ] Database encrypted/backed up
- [ ] Rate limiting
- [ ] Dependency audit
- [ ] Security audit
- [ ] Device revocation

## CLI

- [ ] Linux
- [ ] macOS
- [ ] Windows
- [ ] Git detection
- [ ] Git worktree support
- [ ] URL normalization
- [ ] scan
- [ ] push
- [ ] pull
- [ ] conflict handling
- [ ] atomic restore

## Backend

- [ ] PostgreSQL migrations
- [ ] Object storage
- [ ] API validation
- [ ] Authorization
- [ ] Audit logs
- [ ] Backups
- [ ] Monitoring
- [ ] Disaster recovery

## Product

- [ ] Landing page
- [ ] Documentation
- [ ] CLI documentation
- [ ] Privacy policy
- [ ] Terms
- [ ] Security page
- [ ] Pricing
- [ ] Support process

---

# 120. Future Roadmap

## v1

```text
Individual developer
Git-aware projects
.env backup
client-side encryption
CLI
dashboard
versioning
```

## v1.5

```text
GitHub repository verification
GitHub stable repository IDs
migration mode
restore-all
secret diff
watch mode
```

## v2

```text
Teams
Organizations
RBAC
shared environments
audit logs
```

## v3

```text
CI/CD
GitHub Actions
deployment integrations
secret rotation
cloud integrations
Kubernetes
```

---

# 121. Product Positioning

Do not position the product as:

> "A better `.env` file."

Position it as:

> **"Your development environment, available on any machine."**

Core promise:

```text
Clone your project.
Run one command.
Get your environment back.
```

---

# 122. Recommended CLI Brand

Primary:

```bash
envvault
```

Possible UX:

```bash
envvault scan
envvault push
envvault pull
envvault projects
envvault environments
envvault devices
envvault status
```

Migration:

```bash
envvault backup
envvault restore
```

Avoid commands requiring:

```bash
sudo envvault ...
```

Normal operation should not require root.

---

# 123. Final Architecture Summary

```text
                       ┌──────────────────────┐
                       │      Developer       │
                       └──────────┬───────────┘
                                  │
                           envvault CLI
                                  │
                 ┌────────────────┴────────────────┐
                 │                                 │
           Git identity                       .env discovery
                 │                                 │
                 └──────────────┬──────────────────┘
                                │
                          local encryption
                                │
                                ▼
                         encrypted payload
                                │
                              HTTPS
                                │
                                ▼
                      ┌────────────────────┐
                      │      EnvVault API  │
                      └─────────┬──────────┘
                                │
                   ┌────────────┴─────────────┐
                   │                          │
                   ▼                          ▼
             PostgreSQL                    R2/S3
             metadata                    ciphertext
                   │                          │
                   └────────────┬─────────────┘
                                │
                                ▼
                         EnvVault Web App
```

---

# 124. The Fundamental Design

The entire platform can be reduced to this:

```text
.env file
   ↓
nearest Git repository
   ↓
Git remote
   ↓
canonical repository identity
   ↓
EnvVault project
   ↓
environment
   ↓
encrypted version
   ↓
cloud
```

Restoration:

```text
cloned repository
   ↓
Git remote
   ↓
canonical repository identity
   ↓
EnvVault project
   ↓
environment
   ↓
download ciphertext
   ↓
decrypt locally
   ↓
restore .env
```

The local username, local project folder, and machine name are deliberately **not part of the core project identity**.

---

# 125. Immediate Next Action

Do not begin by building the SaaS dashboard.

Start with the hardest and most differentiated component:

```text
EnvVault CLI
       ↓
Filesystem scanner
       ↓
Git repository detector
       ↓
Git remote normalizer
       ↓
Project identity engine
```

Once this works reliably, build encryption.

Once encryption works reliably, build the API.

Once the API works, build the dashboard.

This keeps the project technically focused and prevents spending weeks building UI before proving the core workflow.
