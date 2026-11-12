"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from "motion/react";
import { Lock, RotateCcw, ScanSearch } from "lucide-react";
import { SectionHeading } from "./primitives";

type Line = { t: string; c?: "dim" | "ok" | "volt" | "cmd" };

const STEPS: { id: string; icon: typeof Lock; title: string; body: string; lines: Line[] }[] = [
  {
    id: "01",
    icon: ScanSearch,
    title: "Discover",
    body: "envvault scan walks only the roots you configure, finds every .env* (skipping .env.example, node_modules and .git) and resolves each one to its nearest Git repository.",
    lines: [
      { t: "$ envvault scan --path ~/Projects", c: "cmd" },
      { t: "Scanning ~/Projects …", c: "dim" },
      { t: "✓ api/.env              → github.com/acme/api", c: "ok" },
      { t: "✓ web/.env.local        → github.com/acme/web", c: "ok" },
      { t: "✓ infra/.env.production → gitlab.com/acme/ops/infra", c: "ok" },
      { t: "3 repositories · 3 environment files", c: "volt" },
    ],
  },
  {
    id: "02",
    icon: Lock,
    title: "Encrypt",
    body: "Each file is sealed locally with AES-256-GCM: a fresh 12-byte nonce, the canonical remote as associated data, and a 16-byte auth tag. Only the ciphertext envelope leaves your machine.",
    lines: [
      { t: "$ envvault push --yes", c: "cmd" },
      { t: "Deriving key (scrypt) … done", c: "dim" },
      { t: "Encrypting .env.local  AES-256-GCM  aad=github.com/acme/web", c: "dim" },
      { t: '{ "formatVersion": 1, "nonce": "q8Zt…", "authTag": "Yd2…" }', c: "volt" },
      { t: "✓ Uploaded ciphertext → private object storage (v3)", c: "ok" },
    ],
  },
  {
    id: "03",
    icon: RotateCcw,
    title: "Restore",
    body: "On a new machine, clone and pull. EnvVault finds the repo from git remote, decrypts, and writes the file atomically with 0600 permissions. It never silently overwrites.",
    lines: [
      { t: "$ git clone git@github.com:acme/web.git && cd web", c: "cmd" },
      { t: "$ envvault pull --yes", c: "cmd" },
      { t: "Project: github.com/acme/web · env: default · v3", c: "dim" },
      { t: "✓ .env.local restored (0600, fsync + rename)", c: "ok" },
      { t: "$ npm run dev", c: "cmd" },
      { t: "▲ ready on http://localhost:3000", c: "volt" },
    ],
  },
];

const lineColor = (c?: Line["c"]) =>
  c === "cmd" ? "text-white" : c === "ok" ? "text-zinc-200" : c === "volt" ? "text-volt" : "text-zinc-500";

function Terminal({ step }: { step: number }) {
  const s = STEPS[step]!;
  return (
    <div className="glass overflow-hidden rounded-2xl shadow-[0_40px_120px_-30px_rgba(139,124,255,0.35)]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="ml-2 font-mono text-[11px] text-zinc-500">~/Projects — zsh</span>
        <span className="ml-auto font-mono text-[11px] text-volt">step {s.id}</span>
      </div>
      <div className="min-h-[260px] p-5 font-mono text-[12.5px] leading-7 sm:text-[13px]">
        <AnimatePresence mode="wait">
          <motion.div key={step} exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}>
            {s.lines.map((l, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.18, duration: 0.3 }}
                className={`break-words whitespace-pre-wrap ${lineColor(l.c)}`}
              >
                {l.t}
              </motion.div>
            ))}
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ delay: s.lines.length * 0.18, repeat: Infinity, duration: 1 }}
              className="inline-block h-4 w-2 translate-y-0.5 bg-volt"
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Pipeline() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(STEPS.length - 1, Math.floor(v * STEPS.length * 0.999)));
  });

  return (
    <section id="how-it-works" className="relative">
      <div className="px-4 pt-28 sm:px-6 lg:hidden">
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              Three commands.
              <br />
              Zero Slack DMs.
            </>
          }
          sub="New laptop, fresh OS, or a teammate's first day: the environment arrives with the repo."
        />
      </div>

      {/* Desktop: pinned, scroll-scrubbed */}
      <div ref={ref} className="relative hidden h-[300vh] lg:block">
        <div className="sticky top-0 flex h-screen flex-col justify-center gap-12 pt-16">
          <div className="px-6 [&_h2]:text-[44px]">
            <SectionHeading
              eyebrow="How it works"
              title={
                <>
                  Three commands.
                  <br />
                  Zero Slack DMs.
                </>
              }
              sub="New laptop, fresh OS, or a teammate's first day: the environment arrives with the repo."
            />
          </div>
          <div className="mx-auto grid w-full max-w-[1200px] grid-cols-[0.9fr_1.1fr] items-center gap-14 px-6">
            <div className="relative pl-8">
              <div className="absolute top-2 bottom-2 left-0 w-px bg-white/10">
                <motion.div style={{ scaleY: progress }} className="h-full w-full origin-top bg-gradient-to-b from-volt to-iris" />
              </div>
              <div className="space-y-10">
                {STEPS.map((s, i) => {
                  const on = i === active;
                  return (
                    <div key={s.id} className={`transition-all duration-500 ${on ? "opacity-100" : "opacity-35"}`}>
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid h-9 w-9 place-items-center rounded-xl border transition-colors duration-500 ${
                            on ? "border-volt/50 bg-volt/10 text-volt" : "border-white/10 bg-white/[0.03] text-zinc-500"
                          }`}
                        >
                          <s.icon className="h-4 w-4" />
                        </span>
                        <span className="font-mono text-xs text-zinc-500">{s.id}</span>
                        <h3 className="text-2xl font-semibold tracking-tight">{s.title}</h3>
                      </div>
                      <motion.p
                        animate={{ height: on ? "auto" : 0, opacity: on ? 1 : 0 }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden pl-12 text-[15px] leading-7 text-zinc-400"
                      >
                        <span className="block pt-3">{s.body}</span>
                      </motion.p>
                    </div>
                  );
                })}
              </div>
            </div>
            <Terminal step={active} />
          </div>
        </div>
      </div>

      {/* Mobile / tablet: stacked */}
      <div className="mx-auto mt-14 grid max-w-[720px] gap-10 px-4 sm:px-6 lg:hidden">
        {STEPS.map((s, i) => (
          <div key={s.id}>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-volt/40 bg-volt/10 text-volt">
                <s.icon className="h-4 w-4" />
              </span>
              <span className="font-mono text-xs text-zinc-500">{s.id}</span>
              <h3 className="text-xl font-semibold">{s.title}</h3>
            </div>
            <p className="mt-3 text-[15px] leading-7 text-zinc-400">{s.body}</p>
            <div className="mt-4">
              <Terminal step={i} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
