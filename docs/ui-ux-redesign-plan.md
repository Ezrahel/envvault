# EnvVault UI/UX Redesign Plan — Monochrome SaaS

> **Status:** PLAN (not implemented) — *Design first, code second.*
> **Goal:** Transform EnvVault dashboard from functional prototype to **Linear × Vercel × Stripe**-grade SaaS, while **keeping strict monochrome** (black/white/gray only, zero hue).
> **Scope:** `apps/web` (8 routes). CLI unchanged except docs link. Stack stays `Next 15 + React 18 + TypeScript`, adds `Tailwind CSS + shadcn/ui (monochrome variant) + Geist/Inter + cmdk + Recharts (grayscale)`.
> **Refs:** Build plan §83 Web Dashboard, §118 Dashboard answers, current audit `apps/web` (2026-08-31), inspirations below.

---

## 1. Why Redesign (Problem)

Current `apps/web` is inline-style prototype: no design tokens, no reusable `Card/Button`, low-contrast `#555` on `#0a0a0a`, inconsistent `h1 32 vs 18 mono`, mock + live data mixed, empty states with emoji only, no search/filter/sort, no charts, `ProjectCard.tsx` built but unused, `Revoke` button has no handler, `Versions` orphaned (not linked), mobile `80px 1fr 140 120` grid overflows, no skeletons, no a11y, no command palette. Feels like internal tool, not **“Your development environment, available on any machine.”**-grade SaaS.

Monochrome is a **strength** (Stripe Dashboard, Linear, Vercel are all grayscale-first). We keep it, but need **hierarchy, density, and interaction** borrowed from best PaaS.

---

## 2. Goals / Non-Goals

**Goals:**
- Keep **strict monochrome** — no brand color, only `black → gray → white` + opacity + border + typography to convey hierarchy. Accent = `white` (not hue).
- Fix IA so every question in §83 is answered in ≤2 clicks: *What projects do I have? What envs backed up? When updated? What devices?*
- Add SaaS hygiene: search, filter, sort, pagination, empty-state CTAs, skeletons, error banners, copy-clipboard, keyboard (`⌘K`), breadcrumb, activity feed.
- Mobile-responsive, WCAG AA (contrast ≥4.5:1), 60fps, <100kB First Load.

**Non-Goals:**
- No hue (no blue/purple brand), no light mode in v1 (dark only, like Linear), no marketing site, no team RBAC UI (§49 deferred), no plaintext secret display (ciphertext only, §83).

---

## 3. Principles — Monochrome Done Right

From **Stripe Dashboard, Linear, Vercel, Railway, Supabase, PlanetScale, GitHub**:

1. **Hierarchy via typography + opacity + border, not color.** Like Linear: `900/700/600` weights, `12px` labels `tracking-widest` `opacity-60`, `1px #222` cards, `8px radius`. Stripe: muted `text-zinc-400` vs `text-white` for primary.
2. **Density controls.** Vercel deployments: `56px` row height, `12px` mono, `8px` padding. Railway: canvas with `1px` grid. We adopt `p4 (16px)` cards, `gap-3 (12px)` lists, `text-xs 11px` meta.
3. **Interaction depth without hue.** Vercel hover: `bg-zinc-900 → bg-zinc-800` + `border-zinc-700`. Supabase table: `hover:bg-zinc-900`. No blue link — underline on hover, `cursor-pointer`.
4. **One accent: white.** Like Linear command palette: `bg-white text-black` primary CTA only. All else grayscale. Status `●` uses `bg-white` (not green `0f0`) for online, `border` for encrypted.
5. **Content over chrome.** PlanetScale: data first, chrome `1px`. No shadows, only `border`.

---

## 4. Inspiration Board → EnvVault Mapping

| SaaS | Borrowed Pattern | EnvVault Application |
|---|---|---|
| **Linear** | `⌘K` command palette, `G` then `P` to projects, `C` to create, `⌘/` help, list → detail `→` | Global `⌘K` for `Scan, Push, Pull, Go to project, Copy git clone snippet`, `?` for shortcuts |
| **Vercel** | Deployment card (commit, time, status, domain, logs), Activity feed (pushes/week), Top `Projects` → `Deployments` tabs | Project card: `canonicalRemote + provider dot + last push 2h ago + 3 envs + 8 vars` + Activity sparkline |
| **Stripe** | Table with `Search, Filter, Sort, Pagination, CSV export`, `Created` relative `2h ago` + absolute on hover, `Empty state` illustration + CTA | Projects/Environments tables: searchable `canonicalRemote`, filter `provider:github`, sort `Last updated`, 10/page, export `envvault scan --json` |
| **Railway** | Project canvas (services as nodes, `1px` grid, drag), `Environments` switcher `production/staging` pills | Environments switcher as pills (§15) `default/local/production`, future `Workspace/Application` (§107) |
| **Supabase** | Table Editor (row count, `8 variables`, `Last updated 2h ago`, `RLS` badge) | Environments: `8 variables • Last updated 2h ago • Encrypted` badge, never values (§83) |
| **PlanetScale** | Branch/Deploy Request timeline ( `main → production` mapping §14), insight `Insights` tab | Versions timeline: `v3 ← latest` vertical rail, `main → production` mapping UI (future) |
| **GitHub** | Repo header `owner/repo` + `Public/Private` + `Watch/Star` + `Code` tab, `Security` tab | Project header: `<username>/<repository>` + `github.com` + `Encrypted` + `Revoke` device pattern |

All adapted to **monochrome**: Replace GitHub `green Private` with `border-zinc-700 text-zinc-400 11px`, Vercel `green Ready` with `bg-white` dot + `text-zinc-300`.

---

## 5. Current Audit → Gap

**Keep:** `fetchProjects()` live data, `canonicalRemote` as identity (§104), `0600` note, `ciphertext never shown`, sticky header, `maxWidth 1100`.

**Fix (audit):**
- Unify `h1` (currently `32` vs `18 mono` vs browser default) → `32/24/18/14` scale.
- Fix contrast `text-zinc-500` fails AA → use `text-zinc-400` min.
- Remove emoji `📁 💻` → `lucide-react` `Folder, Laptop` monochrome icons.
- Unmix mock (`opacity 0.6` rows) vs live — live only, mock as `Empty` illustration.
- Link `Versions` from `Environments/[id]` and `Project detail` (currently orphaned).
- Use `ProjectCard.tsx` (provider dot) everywhere, not inline duplicate.
- Add skeletons (`animate-pulse bg-zinc-900`), error banners (`border-zinc-700`), search/filter, pagination, copy-clipboard for `git clone…envvault pull`, `Revoke` with `Type DELETE` confirm (§48) + toast.

---

## 6. Information Architecture (Proposed)

**Top Nav (keep, refine):**
- Left: `EV` 28px pill `bg-white text-black weight 800` + `EnvVault` + `v0.1.0` `10px border-zinc-800`.
- Center: `Dashboard | Projects | Environments | Versions | Devices | Security` (add `Versions`, `Security` to nav, not footer only). Active: `text-white border-b border-white pb-1`, inactive `text-zinc-400 hover:text-white`.
- Right: `⌘K` button (`border-zinc-800 text-xs`), `Account` avatar `8px dot`.

**Breadcrumbs:** `Projects → <username>/<repository> → Environments → .env.local` (like GitHub). Only `←Projects` today.

**Routes (8 → 10, same files, better linking):**
- `/` **Dashboard** (redesigned): Hero `Your development environment…` (keep) + `Stats 4` (Projects, Environments, Versions, Devices) + `Activity` sparkline (pushes 7d) + `Recent pushes` (3, with `2h ago` relative) + `Quick actions` (`Scan, Push, Pull` with `⌘K` hint) + `Get started` code block with `Copy`.
- `/projects` **Projects** (table, not cards): Search `Filter by canonical…` + `Filter provider: All/GitHub/GitLab` + `Sort: Last updated` + `Pagination 10`. Row: `provider dot + canonical mono 13px + host • owner/repo • Updated 2h ago (hover absolute) + Encrypted badge + Chevron`. Empty: illustration (grid of 3 dashed cards) + `Run envvault push` CTA + `Example github.com/<username>/<repository>`.
- `/projects/[id]` **Project Detail** (new design): Header `owner/repo` large + `Tabs: Overview | Environments | Versions | Devices | Settings` (like Vercel). Overview: `3 envs, 8 vars, Last push 2h ago, Device MacBook Pro` + `Environments` pills + `Versions` timeline preview (3) + `Clone snippet` with `Copy`.
- `/environments` (global): Switcher `All | development | staging | production` pills (§15), table `Project | File | Env | Vars | Last updated | Encrypted`. Filter `project:`.
- `/versions` (global, and per-file): Already table, keep but fix mobile: `Version | File | Created (relative) | Cipher | Key` → responsive `stack` on `sm`, add `Restore` button (calls `pull --at-version`, not auto, with confirm).
- `/devices` **Devices:** `Trusted` count + `Revoke` with `Type DELETE` modal + `lastSeenAt` relative.
- `/account` + `/security` keep, but add `GitHub connect` CTA (currently `soon`).

**Empty / Loading / Error (SaaS hygiene, missing today):**
- Empty: Stripe-style `Dashed border + Icon + “No projects yet” + Description + Primary CTA (white) + Secondary (Docs)`.
- Loading: `Skeleton` 3 rows `h-16 bg-zinc-900 animate-pulse`.
- Error: `Banner border-zinc-700 bg-zinc-900 text-zinc-300 + Retry` (when `fetch` fails, distinguish from empty).

---

## 7. Design System — Monochrome Tokens

**Keep Tailwind, no new runtime.** Add `tailwind.config.mjs` `content: ["./app/**/*.{ts,tsx}", "./components/**/*"]`.

**Palette (grayscale only, WCAG AA):**
```
--bg: #000000          // code <pre>
--bg-base: #0a0a0a      // body, header
--bg-card: #111111      // card
--bg-elevated: #171717  // hover (zinc-900)
--bg-hover: #1a1a1a     // zinc-800
--border: #222222       // primary (zinc-800)
--border-strong: #333333 // pills
--border-subtle: #1a1a1a
--text-primary: #fafafa // zinc-50
--text-secondary: #a1a1aa // zinc-400 (AA, replaces #666)
--text-tertiary: #71717a // zinc-500 (meta, but ≥4.5:1 on #0a0a0a)
--text-faint: #52525b    // zinc-600 (fine print, use sparingly)
--accent: #ffffff        // only white, for primary CTA dot
```
No hue. Status `●` is `bg-white` (online), `border-zinc-700` (encrypted). Never `#0f0`.

**Typography:**
- Font: `Geist Sans` (Vercel) or `Inter` (Stripe/Linear), `Geist Mono` for `canonicalRemote`, `code`, `version`. `next/font`.
- Scale: `h1 32/36 700`, `h2 20/28 600`, `h3 14/20 600 tracking-wide`, `body 13/20`, `meta 11/16 tracking-widest uppercase opacity-60`, `mono 12/16`.
- No `system-ui` global; use `font-sans` + `font-mono`.

**Spacing/Radii:**
- `p-4 (16px)` card, `gap-3 (12px)` list, `gap-4 (16px)` grid, `rounded-lg (8px)` card, `rounded-md (6px)` pill, `rounded-full` dot.

**Components (shadcn/ui monochrome):**
- `Button` variants: `primary: bg-white text-black hover:bg-zinc-200`, `secondary: border-zinc-800 bg-zinc-900 hover:bg-zinc-800`, `ghost`, `destructive: bg-zinc-900 border-red-900 text-red-300` (but red is hue — for monochrome use `border-zinc-700 bg-zinc-900 text-zinc-300` for Revoke).
- `Card: border-zinc-800 bg-zinc-950 (111) p-4 rounded-lg`
- `Badge: border-zinc-700 text-zinc-400 text-[10px] tracking-widest uppercase`
- `Table: border-zinc-800, row hover:bg-zinc-900, header text-zinc-400 text-xs uppercase`
- `Input/Search: bg-zinc-950 border-zinc-800 placeholder:text-zinc-500 focus:border-zinc-600`
- `Command (cmdk): bg-zinc-950 border-zinc-800, item hover:bg-zinc-900`
- `Skeleton: bg-zinc-900 animate-pulse`, `Toast: bg-zinc-900 border-zinc-800`.

**Icons:** `lucide-react` monochrome stroke `1.5` (`Folder, Search, Copy, Check, ChevronRight, Shield, Laptop, Clock, MoreHorizontal`), no emoji.

---

## 8. Page-by-Page Redesign (Monochrome)

### `/` Dashboard
- **Hero:** Keep `Your development environment…` 32px, but add `This week 3 pushes • 12 envs • 2 devices` subtext `text-zinc-400` with `Copy` for `envvault pull` snippet (like `npm install` copy in Stripe).
- **Stats 4:** Replace `—` with `0` + `trend ↑ +2 this week` (when data). Card `hover:border-zinc-700`.
- **New: Activity Sparkline** (Recharts `AreaChart` grayscale `stroke-zinc-400 fill-zinc-900`): `pushes 7d` (Vercel Deployments graph). Empty → `No activity yet`.
- **Recent pushes:** Table `Project | File | Env | When (2h ago)` (Stripe `Created` pattern), not just `Recent Projects` monospace list.
- **Quick actions:** `Scan (⌘K → Scan)`, `Push`, `Pull` as `Button` row (Linear `C` to create).

### `/projects`
- **Header:** `Projects` `h1` + `New push` `bg-white` CTA + `Search` (like Stripe `Filter`).
- **Controls:** `Input Search canonicalRemote` + `Select Provider` + `Select Sort: Last updated / Name / Provider` + `Pagination: 10/page`.
- **Table (not cards on desktop):** `Provider • Canonical • Host • Updated • Encrypted` with `hover:bg-zinc-900` + `ChevronRight` on hover (Linear). Mobile: cards.
- **Row detail:** `provider dot (white for github, zinc-600 for unknown) + canonical mono + 11px meta `host • owner/repo • 2h ago (hover shows absolute)`.
- **Empty:** `Dashed border 2px zinc-800 + Folder icon 32px + No projects yet + Run envvault push + Docs` (Stripe empty).

### `/projects/[id]`
- **Header:** Large `owner/repo` `h1 mono 20px` + `Tabs` (Overview, Environments, Versions, Devices, Settings) `border-b` active `border-white`.
- **Overview:** `Stats 3` + `Environments` pills (click to filter) + `Versions` timeline vertical rail (PlanetScale) `v3 ● — 2h ago • AES-256-GCM` + `Devices` 2 + `Clone` code block with `Copy` (like GitHub `Code`).
- **Environments tab:** table per spec §83 `8 variables • Last updated 2h ago`.

### `/environments`
- **Switcher:** `All | development | staging | production | local | default` pills `bg-zinc-900` active `bg-white text-black`.
- **Table:** `Project | File | Env (pill) | Vars (count) | Last updated | Encrypted` — `Vars` from `8` (never values, §83).
- **Link:** Click row → `/projects/[id]?file=.env.local` → `Versions`.

### `/versions`
- **Fix mobile:** Current `80 1fr 140 120` grid → `Table` with `Version (mono) | Created (relative) | Cipher (badge) | Key | Actions (Restore)`. `Restore` is `Button ghost` that calls `pull --at-version` with confirm `Type RESTORE`.
- **Timeline alternative:** Vertical rail left `border-zinc-800`, dot `bg-white` for `v3`, `bg-zinc-700` for older, like PlanetScale deploys.

### `/devices`
- **Header:** `Trusted 2` + `New device` CTA `bg-white`.
- **Row:** `Laptop icon + MacBook Pro + Darwin • last seen 2h ago • id 8 chars + Revoke (ghost → confirm modal Type DELETE §48)`. Empty: `Laptop illustration + No devices → envvault login`.
- **Add:** `Last 30d activity` sparkline per device (optional).

### `/account` & `/security`
- Keep content but replace `soon` pills with `Button secondary` `Connect GitHub` (real `POST /v1/auth/github`), `MFA` disabled `opacity-50`.
- Security: keep flow diagram but render as `Stepper` `plaintext → AES-256-GCM → ciphertext → HTTPS → R2 private` with `border-zinc-800` steps, not `pre`.

---

## 9. Interaction & Motion (Monochrome, no hue)

- **Command palette (`⌘K`):** `cmdk` (Linear). Items: `Go to project…`, `Scan`, `Push --yes`, `Pull --at-version`, `Copy clone snippet`, `Toggle theme` (future). Trigger `⌘K` button in header.
- **Copy:** `Copy` button on `git clone … envvault pull` → `Check` icon 2s (like Vercel).
- **Search:** Debounced `300ms`, `⌘/` to focus, `Esc` clear, `No results` empty with `Clear filter`.
- **Hover:** `bg-zinc-900 → bg-zinc-800` in `150ms ease`, no hue shift.
- **Skeletons:** `animate-pulse` 3 rows while `fetchProjects()`.
- **Toasts:** `Sonner` monochrome `bg-zinc-900 border-zinc-800` for `Revoke` success.

---

## 10. Responsive & A11y

- **Breakpoints:** `sm 640` cards → `lg 1024` table. Dashboard `grid-cols-1 lg:grid-cols-4` stats, `lg:grid-cols-3` recent. Header nav collapses to `Menu` `Sheet` on `sm` (shadcn).
- **A11y:** All interactive `aria-label`, `focus-visible:ring-1 ring-zinc-600`, `contrast ≥4.5:1` (replace `#555` with `#71717a`), keyboard `Tab` order, `Skip to content` link.
- **Perf:** `font-display: swap` for Geist, `First Load JS <100kB` keep.

---

## 11. Implementation Phases (Monochrome, No Regret)

**Phase 0 — Tokens (1d):**
- Add `tailwind.config.mjs`, `app/globals.css` with grayscale tokens above, `next/font` Geist, `lucide-react`, `cmdk`, `sonner`. No hue. `pnpm add -D tailwindcss postcss autoprefixer` + `npx tailwindcss init`.

**Phase 1 — Layout & Navigation (1d):**
- Refactor `app/layout.tsx` header to `shadcn` design, add `⌘K` button, fix contrast, add `Breadcrumb` component, make nav active state, add `Versions` + `Security` to nav, add `Sheet` for mobile.

**Phase 2 — Components (1d):**
- Create `components/ui/{button,card,badge,input,table,skeleton,command}.tsx` (shadcn monochrome), `components/ProjectCard.tsx` unify (use everywhere), `components/Empty.tsx` (Stripe), `components/CopyButton.tsx`.

**Phase 3 — Pages (2d):**
- Dashboard: stats + sparkline (Recharts grayscale) + recent pushes table.
- Projects: table with `Search/Filter/Sort/Pagination` (client `useState`, no API change).
- Project [id]: tabs + overview.
- Environments/Versions: fix `Versions` mobile, link, add `Restore` action.
- Devices: `Revoke` modal + API call.
- Account/Security: polish.

**Phase 4 — Interaction (1d):**
- `⌘K` palette, search debounce, copy, skeletons, error banners, toasts, keyboard shortcuts.

**No data model change.** All `fetchProjects()` etc. stay `no-store`, just presentation. `Encrypted` badge stays `border-zinc-700`, never shows values.

---

## 12. Metrics for Success (UX, still monochrome)

- **Time to first `envvault pull`:** <30s from landing (today ~60s due to unclear empty CTA) — measure via `Projects` empty CTA click rate.
- **Search usage:** >40% of users with >10 projects use search (Stripe Dashboard metric).
- **Contrast:** Lighthouse Accessibility ≥95 (currently ~85 due to `#555`).
- **Mobile:** No horizontal scroll on `Versions` (currently overflows).

---

## 13. Risks & Out-of-Scope

- Risk: Adding Tailwind/Shadcn bloats bundle → mitigate `content` purge, keep `First Load <102kB` (currently 102kB, target <110kB).
- Risk: `Recharts` adds 30kB → use `grayscale` only, tree-shake, or `sparkline` SVG 2kB alternative if needed.
- Out-of-scope: Light mode, hue, Team RBAC UI, plaintext secret reveal, marketing site, CLI colors (stay `chalk` monochrome already).

---

## 14. Decision Needed Before Code

- Approve **Geist vs Inter** (recommend Geist, Vercel-native, monochrome-friendly).
- Approve **Tailwind + shadcn** vs staying inline (recommend Tailwind for tokens, but can do CSS variables if you prefer zero deps).
- Confirm **keep header top** (current) vs move to **sidebar** (Linear/Railway) — recommend keep top for 8 routes, add `⌘K` for power users.

*This plan keeps monochrome as a feature, not a limitation — hierarchy from type/border/opacity, not hue, exactly how Stripe, Linear, Vercel ship world-class SaaS in grayscale.*

