"use client";
import { motion } from "motion/react";
import { FolderTree, History, Laptop, ShieldCheck, WifiOff, Hand } from "lucide-react";
import { Reveal, SpotlightCard } from "./primitives";

function Versions() {
  const rows = [
    { v: "v3", t: "2h ago", latest: true },
    { v: "v2", t: "yesterday" },
    { v: "v1", t: "3 days ago" },
  ];
  return (
    <div className="relative mt-6 space-y-2 pl-5">
      <div className="absolute top-2 bottom-2 left-[7px] w-px bg-gradient-to-b from-volt to-transparent" />
      {rows.map((r, i) => (
        <motion.div
          key={r.v}
          initial={{ opacity: 0, x: 12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 + i * 0.12 }}
          className="relative flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2 font-mono text-[12px]"
        >
          <span className={`absolute -left-[17px] h-2.5 w-2.5 rounded-full ${r.latest ? "bg-volt shadow-[0_0_12px_var(--color-volt)]" : "bg-zinc-700"}`} />
          <span className={r.latest ? "text-white" : "text-zinc-400"}>
            {r.v} {r.latest && <span className="ml-1 text-volt">← latest</span>}
          </span>
          <span className="text-zinc-600">{r.t}</span>
        </motion.div>
      ))}
      <div className="pt-1 font-mono text-[11px] text-zinc-500">$ envvault pull --at-version 2</div>
    </div>
  );
}

function Monorepo() {
  return (
    <pre className="mt-6 rounded-xl border border-white/[0.07] bg-black/30 p-3 font-mono text-[12px] leading-6 text-zinc-400">
      {"acme/\n├─ "}
      <span className="text-white">.git</span>
      {"\n├─ apps/web/"}
      <span className="text-volt">.env</span>
      {"  "}
      <span className="text-zinc-600">→ web</span>
      {"\n└─ apps/api/"}
      <span className="text-volt">.env</span>
      {"  "}
      <span className="text-zinc-600">→ api</span>
    </pre>
  );
}

function Atomic() {
  return (
    <div className="mt-6 space-y-2 font-mono text-[12px]">
      {["write .env.local.tmp", "fsync()", "rename → .env.local", "chmod 0600"].map((s, i) => (
        <motion.div
          key={s}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 + i * 0.25 }}
          className="flex items-center gap-2"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-volt" />
          <span className="text-zinc-300">{s}</span>
        </motion.div>
      ))}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: "0%" }}
          whileInView={{ width: "100%" }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, delay: 0.2, ease: "easeInOut" }}
          className="h-full rounded-full bg-gradient-to-r from-volt to-iris"
        />
      </div>
    </div>
  );
}

function Offline() {
  return (
    <div className="mt-6 flex items-center gap-3">
      <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-black/30">
        <WifiOff className="h-5 w-5 text-zinc-400" />
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-volt shadow-[0_0_10px_var(--color-volt)]" />
      </div>
      <div className="font-mono text-[12px] leading-6 text-zinc-400">
        <div>
          <span className="text-white">scan</span> · <span className="text-white">status</span> · <span className="text-white">diff</span>
        </div>
        <div className="text-zinc-600">work with no network</div>
      </div>
    </div>
  );
}

function Consent() {
  return (
    <div className="mt-6 rounded-xl border border-white/[0.07] bg-black/30 p-3 font-mono text-[12px] leading-6">
      <div className="text-zinc-400">.env.local exists and differs.</div>
      <div className="text-white">
        Overwrite? <span className="text-zinc-500">[y/N]</span>{" "}
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="text-volt"
        >
          N
        </motion.span>
      </div>
      <div className="text-zinc-600">Aborted. Nothing written.</div>
    </div>
  );
}

function Devices() {
  return (
    <div className="mt-6 flex items-center justify-center gap-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
          className={`grid h-14 w-16 place-items-center rounded-xl border ${i === 1 ? "border-volt/40 bg-volt/10" : "border-white/10 bg-black/30"}`}
        >
          <Laptop className={`h-5 w-5 ${i === 1 ? "text-volt" : "text-zinc-500"}`} />
        </motion.div>
      ))}
    </div>
  );
}

const CARDS = [
  { span: "md:col-span-2", icon: History, title: "Every push is a version", body: "Roll back a bad push in one command. Each version is its own sealed envelope.", visual: <Versions /> },
  { span: "", icon: FolderTree, title: "Monorepo-native", body: "Each .env resolves to its nearest .git, including worktrees and nested repos.", visual: <Monorepo /> },
  { span: "", icon: ShieldCheck, title: "Atomic & private", body: "Temp file, fsync, rename, 0600. A crash never leaves half a secret on disk.", visual: <Atomic /> },
  { span: "md:col-span-2", icon: Hand, title: "Never a silent overwrite", body: "Pull asks first, defaults to No, and backs up the old file before replacing it.", visual: <Consent /> },
  { span: "", icon: WifiOff, title: "Offline first", body: "Discovery and status run locally. Only the encrypted push touches the network.", visual: <Offline /> },
  { span: "md:col-span-2", icon: Laptop, title: "Trusted devices", body: "Each login registers a device. Lose a laptop? Revoke it; its sessions die.", visual: <Devices /> },
];

export function Bento() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {CARDS.map((c, i) => (
        <Reveal key={c.title} delay={i * 0.06} className={c.span}>
          <SpotlightCard className="h-full p-6">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
                <c.icon className="h-4 w-4 text-volt" />
              </span>
              <h3 className="font-semibold tracking-tight">{c.title}</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{c.body}</p>
            {c.visual}
          </SpotlightCard>
        </Reveal>
      ))}
    </div>
  );
}
