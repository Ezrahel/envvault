"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Check, Copy, Lock } from "lucide-react";
import { DecryptText } from "./decrypt-text";

// three.js only on the client; keeps it out of the server bundle.
const VaultVortex = dynamic(() => import("@/components/three/vault-vortex").then((m) => m.VaultVortex), { ssr: false });

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const fade = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText("npm install -g envvault");
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  return (
    <section ref={ref} className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
      {/* Backdrop layers */}
      <div aria-hidden className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_90%_60%_at_50%_100%,rgba(139,124,255,0.16),transparent_70%)]" />
      <div aria-hidden className="bg-grid absolute inset-0 -z-20 opacity-40 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,#000,transparent_75%)]" />
      <div className="absolute inset-0 -z-10">
        <VaultVortex />
      </div>
      {/* Legibility vignette behind headline + bottom fade into page */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70%] bg-[radial-gradient(ellipse_60%_70%_at_50%_35%,rgba(5,5,7,0.88),transparent_75%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-[var(--bg)]" />

      <motion.div style={{ y, opacity: fade }} className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center px-4 pt-32 text-center sm:px-6 sm:pt-36">
        <motion.a
          href="#playground"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease }}
          className="glass group inline-flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-xs text-zinc-300 transition-colors hover:border-white/20"
        >
          <span className="inline-flex items-center gap-1 rounded-full bg-volt px-2 py-0.5 font-semibold text-black">
            <Lock className="h-3 w-3" /> AES-256-GCM
          </span>
          <span className="hidden sm:inline">Encrypted on your machine, before upload</span>
          <span className="sm:hidden">Encrypted before upload</span>
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </motion.a>

        <motion.h1
          initial={{ opacity: 0, y: 24, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.1, ease, delay: 0.1 }}
          className="mt-7 max-w-[980px] text-[44px] leading-[0.95] font-semibold tracking-[-0.045em] sm:text-[72px] lg:text-[92px]"
        >
          <span className="text-gradient">Your environment,</span>
          <br />
          <DecryptText text="on any machine." trigger="mount" delay={700} className="text-volt-gradient" />
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease, delay: 0.3 }}
          className="mt-6 max-w-[600px] text-[16px] leading-7 text-zinc-400 sm:text-[17px]"
        >
          EnvVault encrypts your <code className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-200">.env</code> files on
          your laptop, binds them to the Git repository (not the folder), and restores them after any clone.
          <span className="text-zinc-200"> Clone. Pull. Run.</span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease, delay: 0.45 }}
          className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
        >
          <Link
            href="/dashboard"
            className="conic-border group inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-semibold text-black shadow-[0_0_40px_-8px_rgba(198,255,74,0.6)] transition-transform active:scale-[0.97] sm:w-auto"
          >
            Get started free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <button
            onClick={copy}
            className="glass group inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl !bg-black/60 px-5 font-mono text-[13px] text-zinc-200 transition-colors hover:border-white/20 sm:w-auto"
            aria-label="Copy install command"
          >
            <span className="text-volt">$</span> npm install -g envvault
            <span className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/5 text-zinc-400 group-hover:text-white">
              {copied ? <Check className="h-3.5 w-3.5 text-volt" /> : <Copy className="h-3.5 w-3.5" />}
            </span>
          </button>
        </motion.div>
      </motion.div>

      {/* Bottom proof strip — facts, not vanity numbers */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 1 }}
        className="relative mx-auto mb-8 grid w-full max-w-[920px] grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] px-0 sm:grid-cols-4"
      >
        {[
          ["0 bytes", "plaintext on the server"],
          ["12 B", "random nonce per push"],
          ["0600", "atomic file restore"],
          ["1 cmd", "to get it back"],
        ].map(([k, v]) => (
          <div key={k} className="bg-[var(--bg)]/80 px-4 py-4 text-center backdrop-blur">
            <div className="font-mono text-lg font-semibold text-white">{k}</div>
            <div className="text-[11px] text-zinc-500">{v}</div>
          </div>
        ))}
      </motion.div>
    </section>
  );
}
