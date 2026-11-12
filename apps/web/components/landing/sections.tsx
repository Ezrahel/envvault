"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check, Minus, Plus } from "lucide-react";
import { Reveal, SpotlightCard } from "./primitives";

/* ── Comparison ─────────────────────────────────────────────────── */
const ROWS: [string, boolean, boolean, boolean][] = [
  ["Bound to Git repo, not folder", true, false, false],
  ["Encrypted before upload", true, true, false],
  ["Restore with one command after clone", true, false, false],
  ["Version history & rollback", true, true, false],
  ["Atomic write, 0600 permissions", true, false, false],
  ["Works offline for discovery", true, false, true],
];

export function Comparison() {
  return (
    <Reveal>
      <div className="glass overflow-x-auto rounded-3xl" data-lenis-prevent>
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-zinc-500">
              <th className="px-5 py-4 font-medium">Capability</th>
              <th className="px-5 py-4 text-center font-semibold text-volt">EnvVault</th>
              <th className="px-5 py-4 text-center font-medium">Password manager</th>
              <th className="px-5 py-4 text-center font-medium">Slack / Notion</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, ...vals]) => (
              <tr key={label} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                <td className="px-5 py-3.5 text-zinc-300">{label}</td>
                {vals.map((v, i) => (
                  <td key={i} className={`px-5 py-3.5 text-center ${i === 0 ? "bg-volt/[0.04]" : ""}`}>
                    {v ? (
                      <Check className={`mx-auto h-4 w-4 ${i === 0 ? "text-volt" : "text-zinc-400"}`} />
                    ) : (
                      <Minus className="mx-auto h-4 w-4 text-zinc-700" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Reveal>
  );
}

/* ── Pricing ────────────────────────────────────────────────────── */
const PLANS = [
  { name: "Free", price: "$0", per: "", blurb: "For indie hackers", items: ["5 projects", "3 environments each", "1 device"], cta: "Get started", featured: false },
  { name: "Pro", price: "$8", per: "/mo", blurb: "For people who switch machines", items: ["Unlimited projects", "Full version history", "Unlimited devices", "Watch mode (auto-push)"], cta: "Start Pro", featured: true },
  { name: "Team", price: "$29", per: "/mo", blurb: "For engineering teams", items: ["Shared projects", "Role-based access", "Audit logs"], cta: "Contact us", featured: false },
];

export function Pricing() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {PLANS.map((p, i) => (
        <Reveal key={p.name} delay={i * 0.08}>
          <SpotlightCard tilt className={`flex h-full flex-col p-7 ${p.featured ? "conic-border bg-ink-850" : ""}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{p.name}</h3>
              {p.featured && <span className="rounded-full bg-volt px-2 py-0.5 text-[10px] font-semibold text-black">Most popular</span>}
            </div>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-5xl font-semibold tracking-tight">{p.price}</span>
              <span className="text-sm text-zinc-500">{p.per}</span>
            </div>
            <p className="mt-2 text-sm text-zinc-500">{p.blurb}</p>
            <ul className="mt-6 space-y-3 text-sm">
              {p.items.map((it) => (
                <li key={it} className="flex items-center gap-2.5 text-zinc-300">
                  <Check className="h-4 w-4 text-volt" /> {it}
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard"
              className={`mt-8 inline-flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-transform active:scale-[0.97] ${
                p.featured ? "bg-white text-black" : "border border-white/10 bg-white/[0.04] text-white hover:border-white/20"
              }`}
            >
              {p.cta}
            </Link>
          </SpotlightCard>
        </Reveal>
      ))}
    </div>
  );
}

/* ── FAQ ────────────────────────────────────────────────────────── */
const FAQ = [
  ["Can you see my secrets?", "No. Files are encrypted on your machine before upload. The server stores ciphertext and metadata (repo, environment name, size, timestamps), never values, and never your key."],
  ["What if I lose my master key?", "Your secrets can't be recovered, by design. That is the trade-off for maximum privacy. Encrypted key wrapping and team recovery keys are on the roadmap."],
  ["What if I rename or move the repo?", "Moving folders changes nothing, because identity comes from the Git remote. For a renamed remote, `envvault project link` re-binds the project."],
  ["Monorepos with apps/web/.env and apps/api/.env?", "Each file resolves to its nearest .git, so nested repos and worktrees work as you'd expect."],
  ["GitLab, Bitbucket, self-hosted?", "Yes. Any remote works: host, owner and the full path (including GitLab subgroups) are preserved."],
  ["Does pull run any of my project code?", "Never. Pull decrypts and writes files. It doesn't run npm install, scripts or hooks."],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-[820px] divide-y divide-white/[0.06] rounded-3xl border border-white/[0.07]">
      {FAQ.map(([q, a], i) => {
        const on = open === i;
        return (
          <div key={q}>
            <button
              onClick={() => setOpen(on ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              aria-expanded={on}
            >
              <span className={`text-[15px] font-medium transition-colors ${on ? "text-white" : "text-zinc-300"}`}>{q}</span>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors ${on ? "border-volt/50 bg-volt/10 text-volt" : "border-white/10 text-zinc-500"}`}>
                {on ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-6 pb-5 text-sm leading-7 text-zinc-400">{a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
