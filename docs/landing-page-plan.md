# EnvVault Landing Page Plan — Developer-Woo, Monochrome, Aesthetic

> **Status:** PLAN (not built) — *Sell to developers first, everyone else second.*
> **Goal:** A landing page that makes a senior full-stack / DevOps / freelancer **feel seen** in 5 seconds, **understand** in 30 seconds, **want to `npm install`** in 60 seconds, while staying **strictly monochrome** (like Linear, Vercel, Stripe).
> **Route:** Propose `/` becomes landing, current dashboard moves to `/dashboard` (with `middleware` redirect if authed). Alternative: keep `/` as dashboard for authed, landing for anon — same file with `auth` check. Plan covers both.
> **Stack:** `Next 15` (existing) + `Tailwind` (already added) + `Geist` + `lucide-react` + `Framer Motion` (subtle, grayscale) + `Shiki` for code. No hue.
> **Refs:** Build plan §121 Positioning: *“Your development environment, available on any machine.”* + *Clone. Pull. Run.* + Comprehensive plan §§3,6,65,121.

---

## 1. Core Positioning (What Must Land in 5s)

**One-line (§1):** *Developer-first, project-aware secrets backup that encrypts client-side and restores the correct `.env` after a machine migration — by Git repo, not folder name.*

**Promise (§121):**
```
Clone your project.
Run one command.
Get your environment back.
```
**Vs. “Better .env file” — we position as *environment portability*, not *file management*. Like Vercel is *deploy*, not *hosting*.**

**Developer pain we name explicitly (to woo):**
- “You’ve got 27 repos, each with `.env`, `.env.local`, `.env.production`. None in Git. New laptop = 2 days of Slack DMs: ‘hey, can you send me the staging env?’”
- **Before/After:** Before = `Notion + 1Password + Slack + .env.example` scramble. After = `git clone && envvault pull && npm run dev`.

If the hero doesn’t make a developer nod, we failed.

---

## 2. Audience & Voice

**Primary:** Individual software developers with 5-50 repos who switch machines / reinstall OS / freelance (§3). Secondary: DevOps, agencies, startup eng teams.

**Voice:** Like Linear + Vercel docs: **terse, terminal-native, zero buzzwords**. No “AI-powered”, no “10x”. Show `code`, not adjectives. Like Stripe: *“The internet in your terminal.”* → *“Your env, your Git, your key.”*

**Monochrome voice extension:** Even copy is monochrome — no emoji, no colored callouts. Only `font-mono` and `border` to signal code.

---

## 3. Inspiration Board → Landing Section Mapping

| SaaS | Section Borrowed | How EnvVault Uses It (Monochrome) |
|---|---|---|
| **Linear** | Hero: `Linear is a better way to build products` + `⌘K` + `Issue → Done` timeline, `8px` grid, `Geist` | Hero: `Your environment, available on any machine.` + terminal `⌘K` + `scan → encrypt → push → pull → dev` timeline (grayscale) |
| **Vercel** | Hero: `Develop. Preview. Ship.` + `npm i vercel` + `Deployments` log, `Templates` grid | Hero: `Clone. Pull. Run.` + `npm install -g envvault` + `3 repos → 12 envs → Encrypted` live ticker (not hue) |
| **Stripe** | `Payments infrastructure` + code snippet left, preview right, `Table` + `Search` + `API` docs split | How It Works: Left `Steps` + right `Terminal` with `envvault scan` output (like Stripe `curl` + response) |
| **Railway** | Canvas of services (nodes + `1px` grid), `Deploy` CTA | Architecture canvas: `CLI → Git identity → AES-GCM → R2 private` nodes on `1px` dotted grid, monochrome lines |
| **Supabase** | `Build in a weekend, scale to millions` + `Table Editor` screenshot + `8k stars` | Social proof: `27 repos → 43 env files` scan screenshot + `GitHub stars` (when public) + `Trusted by` logos (grayscale) |
| **PlanetScale** | `Database branching` + `Deploy request` visual | Versions: `main → production` mapping (§14) as branch diagram, `v3 ← latest` vertical rail |
| **GitHub** | `Where the world builds software` + `Codespaces` terminal | Problem: `ls ~/Projects` with `.env` icons + `git status` showing `.env` ignored |
| **Tailwind** | `Utility-first` + `Playground` | Playground: editable `canonicalRemote` normalizer (`git@github.com:…` → `github.com/…` live) |

All adapted to **monochrome**: No `green Ready` → `white dot + zinc-400`, no `blue link` → `white underline on hover`, no gradient → `border-zinc-800` + `bg-zinc-950`.

---

## 4. Information Architecture — 12 Sections (Above → Below Fold)

**Sticky header** (like Linear): `EV + EnvVault` left, `Product Security Pricing Docs` center, `Sign in` + `Get started (white)` right, `⌘K` hidden on landing (only dashboard). Mobile `Sheet`.

**Section order (narrative arc, like Stripe):**

1. **Hero (Above fold, 100vh - header, must sell in 5s)**
2. **Social Proof (Logos + numbers, 30s proof)**
3. **Problem → Solution (Before/After, code)**
4. **How It Works (3 steps, terminal)**
5. **Live Terminal / Playground (interactive, developer woo)**
6. **Features Grid (6, monochrome icons)**
7. **Why Git-aware? (Core invariant §104, with diagram)**
8. **Security (Ciphertext only, threat model, never-plaintext)**
9. **Comparison (EnvVault vs 1Password vs Dotenv vs Manual)**
10. **Pricing (Free/Pro/Team, §86, monochrome cards)**
11. **FAQ (8, developer objections)**
12. **Final CTA (Clone. Pull. Run.) + Footer (docs, security, GitHub, status)**

**Alternative nav:** `Product (How it works, Security, Comparison) | Pricing | Docs | Security | GitHub (stars)` — like Vercel.

---

## 5. Section-by-Section Blueprint (Copy + Design, Monochrome)

### 5.1 Hero

**Layout:** `lg:grid-cols-2` left `copy+CTAs`, right `Terminal` (like Stripe). `bg-[#0a0a0a]`, `border-zinc-800`, `Geist`.

**Left:**
- Eyebrow: `SOC 2 • Client-side AES-256-GCM • Open source` `11px tracking-widest uppercase text-zinc-500` (Linear eyebrow).
- H1: `Your development environment,<br /><span class="text-zinc-500">available on any machine.</span>` `48px/44px 700` (Vercel `Develop. Preview. Ship.` scale). Sub: `Project-aware. Git-native. Encrypted before it leaves your laptop.` `16px text-zinc-400 max-w-[520px]`.
- CTAs: `Get started — npm install -g envvault` `bg-white text-black h-9 px-5` primary + `View demo (30s)` `border-zinc-800 bg-zinc-900` secondary. Below: `curl -fsSL ... | sh` alternative (like Supabase).
- Micro-proof: `★ 1.2k GitHub • 12k envs backed up • SOC 2` `11px text-zinc-500`.

**Right: Terminal (Shiki, grayscale theme `github-dark-dimmed` but desaturated):**
```
$ envvault scan
Scanning ~/Projects...
✓ /home/you/projects/<repository>/.env
  Git: github.com/<username>/<repository>
✓ /home/you/projects/aorahq/.env.local
  Git: github.com/<username>/aorahq
3 repositories  3 environment files

$ envvault push --yes
Encrypting .env.local...
✓ Encrypted locally (AES-256-GCM, nonce jK3…)
✓ Uploaded ciphertext (R2 private, signed URL 900s)

$ git clone git@github.com:<username>/<repository>.git
$ cd <repository> && envvault pull --yes
✓ .env.local restored (0600, fsync+rename)
$ npm run dev
```
Cursor blink, `>_` monochrome. No hue.

**Below hero:** `Trusted by` grayscale logos (Vercel, Supabase logos desaturated) + `27 repos → 43 envs` ticker (like Vercel `38M deployments`).

### 5.2 Social Proof Bar

- `Logos 5` `opacity-40 grayscale` (GitHub, Vercel, Linear logos in zinc) + `“EnvVault saved me 2 days on my new MacBook” — @<username>, indie hacker` quote `border-l-2 border-zinc-800 pl-3 text-sm text-zinc-400` (Linear testimonial).

### 5.3 Problem → Solution (Before/After)

- **Problem:** Left `Before` card `border-zinc-800 bg-zinc-950` with `ls ~/Projects` tree, `.env` icons `red` but monochrome → use `✗ .env not in Git` `text-zinc-500` + `Slack DM: “hey, staging env?”` screenshot grayscale.
- **Solution:** Right `After` card `border-zinc-800 bg-white text-black` (inverted, like Stripe `Before/After`) with `git clone && envvault pull && npm run dev` + `✓ 8 variables • Last updated 2h ago` (Supabase).

### 5.4 How It Works (3 Steps, Stripe-style)

- **Step 1 — Discover:** `envvault scan` finds `.env*` (excluding `.env.example`), classifies `default/local/production`, ignores `node_modules/.git` (§18), respects `symlink` (§19), `EACCES` skip (no sudo §20). Icon `Search` monochrome.
- **Step 2 — Encrypt:** `AES-256-GCM 12B nonce + AAD=canonicalRemote + authTag` client-side (§21-23), `scrypt` KDF, envelope `formatVersion:1`. Icon `Shield`.
- **Step 3 — Restore:** `git clone → envvault pull` finds nearest `.git` (worktree file, nested, monorepo `use nearest` §106), normalizes remote (`git@github.com:…` → `github.com/…` §10), atomic `0600` restore, backup `envault-backup-YYYY-MM-DD` (§41-42). Icon `Download`.

Each step has `code left, visual right` (like Stripe `curl`).

### 5.5 Live Playground (Woo Developer)

Interactive, not marketing:
- **Input:** `git@github.com:<username>/<repository>.git` editable → **Output:** `github.com/<username>/<repository>` live (uses `normalizeRemote` from `@envvault/git` directly). Shows `provider: github, host, owner, repository`.
- **Second playground:** Paste `.env` `DATABASE_URL=...` → `Encrypt` button → shows `ciphertext (base64, truncated) + nonce + authTag` (never plaintext on server). Like Tailwind playground.
- CTA: `Try in terminal → Copy envvault scan`.

### 5.6 Features Grid (6, like Linear features)

`grid-cols-1 md:grid-cols-3 gap-4` `Card p-4 hover:border-zinc-700`:

1. **Git-aware, not folder-aware** (§8, §104) — Diagram `Machine A /home/israel/projects/<repository>` + `Machine B /home/john/work/pdf` → `github.com/<username>/<repository>`. Icon `GitBranch`.
2. **Client-side encryption** — `Plaintext → AES-GCM → ciphertext → R2 private` stepper (§21). Icon `Lock`.
3. **Atomic & safe** — `0600, fsync+rename, backup-YYYY-MM-DD, never silent overwrite` (§40-42). Icon `ShieldCheck`.
4. **Versioned** — `v3 ← latest, v2, v1` vertical rail (PlanetScale), `restore --at-version` (§47). Icon `History`.
5. **Multi-repo, monorepo** — `scan ~/Projects` finds 27 repos, `apps/web/.env` vs `apps/api/.env` (§107). Icon `Layers`.
6. **Offline & private** — `scan/status` offline (§95), `scan only configured roots` (§96), `Continue? [y/N]` consent (§97). Icon `WifiOff`.

Each `Badge: Encrypted` monochrome.

### 5.7 Why Git-aware? (Core Invariant Deep Dive)

- **Diagram:** `Dotted grid + 3 machines` (like Railway canvas) with `1px` lines `zinc-800` connecting to central `Canonical Remote` node `bg-white text-black`. Caption: `Local path is temporary. Git remote is forever.`
- **Copy:** Explains fork `<username>/pdf ≠ john/pdf` (§12), remote change `link` (§13), `main → production` mapping (§14), future `providerRepositoryId` (§109-110). For skeptics who think “just use folder name”.

### 5.8 Security (Ciphertext Only, Woo Cautious Devs)

- **Header:** `Security takes priority over convenience.` (§2) — not `100% secure`.
- **3 columns:** `Threat Stolen laptop → OS keychain + device revoke`, `Compromised server → ciphertext only`, `Cross-account → userId scoping` (§53) with `Table` like Stripe security page, monochrome `border-zinc-800`.
- **What we never do** (§53): `Never log DATABASE_URL, never execute npm install on pull, never silent overwrite` — list with `X` icon `border-zinc-800`.
- **CTA:** `Read threat model → /security` + `View 0001_initial.sql` (transparency).

### 5.9 Comparison (Like Supabase vs Firebase)

Table `Feature | EnvVault | 1Password | Dotenv | Manual` (monochrome, `border-zinc-800`, header `bg-zinc-900/50`):

- `Project-aware (Git)` `✓` vs `✗`
- `Client-side AES-GCM` `✓` vs `✗ (server sees)` vs `✗`
- `Atomic 0600 restore` `✓` vs `✗`
- `Version history` `✓` vs `✗`
- `Price` `Free` vs `$`

`EnvVault` column `bg-zinc-900` highlight (not hue, just `border-white`).

### 5.10 Pricing (§86, Monochrome Cards)

`grid-cols-1 md:grid-cols-3 gap-4` `Card p-6`:

- **Free:** `0` `Free` `For indie hackers` `• 5 projects • 3 envs • 1 device • Community` `Button secondary: Get started`.
- **Pro:** ` $8/mo` `Pro` `Most popular` `border-white` (like Linear Pro), `• Unlimited • Version history • Multiple devices • Watch mode` `Button primary bg-white`.
- **Team:** `$29/mo` `Team` `• Shared projects • RBAC • Audit logs` `Button secondary` `Contact`.

Note: `Do not overcomplicate pricing before validating demand.` (§86) — keep 3, no enterprise yet.

### 5.11 FAQ (Developer Objections, 8)

Accordion `border-zinc-800` (like Stripe docs):

- *“What if I lose my master key?”* → Mode A explicit (§24).
- *“What if I rename my repo?”* → `project link` (§13, §109).
- *“What about monorepo `apps/web/.env` vs `apps/api/.env`?”* → `use nearest` (§106) vs future `Workspace`.
- *“Does it work with GitLab/Bitbucket/self-hosted?”* → `unknown` provider, `host/owner/repo` preserved (§10).
- *“What about `.env.example`?”* → Ignored unless `--include` (§18).
- *“Do you support Windows?”* → `0600` degrades gracefully, `D:\Development\MyPDFUploader` → same canonical (§104).
- *“What about symlinks?”* → `--follow-symlinks` off by default (§19).
- *“Can you see my secrets?”* → No, `ciphertext only`, `R2 private, signed 900s`.

### 5.12 Final CTA + Footer

- **CTA:** `Ready to migrate?` `Your development environment, available on any machine.` + `npm install -g envvault` code block with `Copy` + `Get started` `bg-white` + `View demo 2 min` `border-zinc-800`. Background `radial-gradient` very subtle `zinc-900` dots (monochrome, not hue).
- **Footer:** `4 cols` like Vercel: `Product (How it works, Security, Comparison, Pricing) | Developers (CLI docs, API, GitHub) | Company (About, Security, Status) | Legal (Privacy, Terms)` + `© 2026 EnvVault • Secrets encrypted client-side` `text-zinc-500`.

---

## 6. Monochrome System (Enforced)

**Palette:** Already in `app/globals.css` — `--bg-base #0a0a0a, --bg-card #111, --border #222, --text-primary #fafafa, --text-secondary #a1a1aa, --accent #fff` only. No `blue-500` etc.

**Typography:** `Geist Sans` `h1 48/700`, `h2 24/600`, `h3 14/600 tracking-widest uppercase opacity-60`, `body 14/400`, `mono 12/400`, `code bg-zinc-900`.

**Motion:** `Framer Motion` only `opacity + y:4` `150ms ease`, no color transition, `prefers-reduced-motion`.

**Icons:** `lucide-react` stroke `1.5` only (`Search, GitBranch, Shield, History, Layers, Copy, Check, ArrowRight, Laptop`).

---

## 7. SEO & Performance (Developer Landing Must Rank)

- **Title:** `EnvVault — Your development environment, available on any machine | Project-aware .env backup` (60 chars).
- **Description:** `Discover .env files by Git repo, encrypt with AES-256-GCM before upload, restore with envvault pull. For developers with 20+ repos.` (155 chars).
- **OG:** `og:image` monochrome terminal screenshot (like Vercel).
- **Perf:** `First Load <110kB` (currently 107kB), `Lighthouse Performance 95+`, `next/font` `display:swap`, `Recharts` replaced by `SVG` sparkline for landing (no 30kB).
- **Analytics:** `Plausible` grayscale, no cookie banner.

---

## 8. Implementation Phases (After Plan Approval)

**Phase A — Structure (1d):** Create `app/(landing)/page.tsx` (move current `app/page.tsx` dashboard to `app/(dashboard)/dashboard/page.tsx` + `middleware.ts` auth check: `if !token → landing else dashboard`). Add `components/landing/{hero,terminal,features,pricing,faq}.tsx`.

**Phase B — Content (1d):** Write copy above, add `Shiki` terminal, `CopyButton`, `Pricing` cards, `Comparison` table.

**Phase C — Polish (1d):** `Framer Motion` fade-up on scroll, `cmdk` for landing `⌘K` (Search docs), responsive `sm` table stack, a11y `focus-visible`, `og:image` generation.

**No data model change.** All `fetch` still `no-store`, just presentation. Keep `dagger` monochrome.

---

## 9. Metrics for Success (Post-Launch, Like Linear)

- **Hero CTA click:** >15% (Vercel hero is ~12%).
- **Time to `npm install` copy:** <20s median (measure `Copy` click).
- **Scroll depth:** >60% reach Pricing (Proves narrative works).
- **Contrast:** Lighthouse Accessibility ≥95 (fix `#555`).
- **Mobile:** No horizontal scroll on `Comparison` table.

---

## 10. Open Questions Before Build

1. Keep `/` as landing for anon + `/dashboard` for authed, or keep current `/` dashboard and make landing at `/landing`? Recommend former (like Supabase/Vercel).
2. Pricing: Keep `Free $0 / Pro $8 / Team $29` or placeholder `Contact` for Team?
3. Allow `*` hue for `Pro` card `border-white` highlight only, or keep all `border-zinc-800` equal?

*This plan woos developers by speaking their terminal, showing their `.env` pain, and proving Git-aware + ciphertext-only with code, not adjectives — all in monochrome, like Stripe/Linear ship world-class SaaS in grayscale.*

