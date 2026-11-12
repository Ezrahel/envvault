"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { GitBranch, KeyRound, ShieldAlert, ShieldCheck, Unlock, Zap } from "lucide-react";

/* ── Remote normalisation (mirror of packages/git normalizeRemote) ── */
export function normalizeRemote(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let host = "";
  let path = "";
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s);
  const scp = s.match(/^([^@]+@)?([^:/]+):(.+)$/);
  if (scp && !hasScheme) {
    host = scp[2] ?? "";
    path = scp[3] ?? "";
  } else if (hasScheme) {
    try {
      const u = new URL(s);
      host = u.hostname;
      path = u.pathname;
    } catch {
      return null;
    }
  } else {
    const i = s.indexOf("/");
    if (i < 0) return null;
    host = s.slice(0, i);
    path = s.slice(i + 1);
  }
  path = path.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\.git$/, "");
  if (!host || !path.includes("/")) return null;
  return `${host.toLowerCase()}/${path}`;
}

/* ── Crypto helpers (WebCrypto) ──────────────────────────────────── */
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(pass: string) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode("envvault-salt-v1"), iterations: 120_000 },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

type Envelope = {
  formatVersion: 1;
  algorithm: "AES-256-GCM";
  keyVersion: 1;
  nonce: string;
  ciphertext: string;
  authTag: string;
};

async function seal(key: CryptoKey, plaintext: string, aad: string): Promise<Envelope> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const out = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: enc.encode(aad), tagLength: 128 }, key, enc.encode(plaintext)),
  );
  return {
    formatVersion: 1,
    algorithm: "AES-256-GCM",
    keyVersion: 1,
    nonce: b64(nonce),
    ciphertext: b64(out.slice(0, -16)),
    authTag: b64(out.slice(-16)),
  };
}

async function open(key: CryptoKey, env: Envelope, aad: string): Promise<string> {
  const ct = fromB64(env.ciphertext);
  const tag = fromB64(env.authTag);
  const joined = new Uint8Array(ct.length + tag.length);
  joined.set(ct);
  joined.set(tag, ct.length);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(env.nonce), additionalData: enc.encode(aad), tagLength: 128 },
    key,
    joined,
  );
  return dec.decode(pt);
}

/* ── .env syntax highlighting ───────────────────────────────────── */
function highlight(src: string) {
  return src.split("\n").map((line, i) => {
    if (/^\s*#/.test(line)) return <div key={i} className="tok-com">{line || " "}</div>;
    const m = line.match(/^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_.]*)(\s*=\s*)(.*)$/);
    if (!m) return <div key={i}>{line || " "}</div>;
    const v = m[4] ?? "";
    const cls = /^["']/.test(v) ? "tok-str" : /^\d+$/.test(v) ? "tok-num" : "tok-val";
    return (
      <div key={i}>
        {m[1]}
        <span className="tok-key">{m[2]}</span>
        <span className="tok-eq">{m[3]}</span>
        <span className={cls}>{v}</span>
      </div>
    );
  });
}

const SAMPLE = `# ~/code/web/.env.local
DATABASE_URL=postgres://app:s3cr3t@localhost:5432/web
JWT_SECRET="k9#Qm2!vLx7@pR4z"
REDIS_URL=redis://localhost:6379
SMTP_PASSWORD=hunter2
PORT=3000`;

type Verdict = { kind: "ok" | "fail"; title: string; detail: string } | null;

export function CipherPlayground() {
  const [remote, setRemote] = useState("git@github.com:acme/web.git");
  const [plain, setPlain] = useState(SAMPLE);
  const [pass, setPass] = useState("correct horse battery staple");
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [tab, setTab] = useState<"envelope" | "server">("envelope");
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [busy, setBusy] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [pulse, setPulse] = useState(0);
  const keyCache = useRef(new Map<string, Promise<CryptoKey>>());
  const preRef = useRef<HTMLPreElement>(null);

  const canonical = useMemo(() => normalizeRemote(remote), [remote]);
  const aad = canonical ?? "";
  const lines = plain.split("\n");
  const varCount = lines.filter((l) => /^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_.]*\s*=/.test(l)).length;

  const getKey = (p: string) => {
    let k = keyCache.current.get(p);
    if (!k) {
      k = deriveKey(p);
      keyCache.current.set(p, k);
    }
    return k;
  };

  useEffect(() => {
    if (typeof crypto === "undefined" || !crypto.subtle) {
      setUnsupported(true);
      return;
    }
    const id = window.setTimeout(async () => {
      try {
        setBusy(true);
        const key = await getKey(pass);
        setEnvelope(await seal(key, plain, aad));
        setVerdict(null);
        setPulse((p) => p + 1);
      } finally {
        setBusy(false);
      }
    }, 220);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plain, pass, aad]);

  const tryOpen = async (mode: "normal" | "tamper" | "wrong-repo") => {
    if (!envelope) return;
    const key = await getKey(pass);
    let env = envelope;
    let useAad = aad;
    if (mode === "tamper") {
      const ct = fromB64(envelope.ciphertext);
      if (ct.length) ct[Math.floor(ct.length / 2)] = (ct[Math.floor(ct.length / 2)] ?? 0) ^ 0x01;
      env = { ...envelope, ciphertext: b64(ct) };
    }
    if (mode === "wrong-repo") useAad = "github.com/someone-else/fork";
    try {
      const out = await open(key, env, useAad);
      setVerdict({ kind: "ok", title: "Decrypted & verified", detail: `${out.length} bytes · ${varCount} variables restored · auth tag valid` });
    } catch {
      setVerdict({
        kind: "fail",
        title: mode === "tamper" ? "Rejected: 1 bit flipped" : "Rejected: wrong repository",
        detail:
          mode === "tamper"
            ? "GCM auth tag mismatch. Corrupted or tampered ciphertext never decrypts."
            : "AAD is bound to the canonical remote. A fork can't open your envelope.",
      });
    }
  };

  const bytes = useMemo(() => (envelope ? Array.from(fromB64(envelope.ciphertext).slice(0, 96)) : []), [envelope]);

  return (
    <div className="glass overflow-hidden rounded-3xl shadow-[0_60px_160px_-40px_rgba(198,255,74,0.18)]">
      {/* Remote bar */}
      <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-center">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 focus-within:border-volt/50">
          <GitBranch className="h-4 w-4 shrink-0 text-zinc-500" />
          <span className="font-mono text-[11px] text-zinc-500">remote</span>
          <input
            value={remote}
            onChange={(e) => setRemote(e.target.value)}
            spellCheck={false}
            aria-label="Git remote URL"
            className="h-10 w-full min-w-0 bg-transparent font-mono text-[13px] text-white outline-none placeholder:text-zinc-600 focus-visible:outline-none"
            placeholder="git@github.com:owner/repo.git"
          />
        </label>
        <div className="flex min-w-0 items-center gap-2 font-mono text-[12px]">
          <span className="text-zinc-500">→ aad</span>
          <span className={`truncate rounded-lg border px-2.5 py-1.5 ${canonical ? "border-volt/40 bg-volt/10 text-volt" : "border-danger/40 bg-danger/10 text-danger"}`}>
            {canonical ?? "unparseable remote"}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2">
        {/* Editor */}
        <div className="border-b border-white/[0.06] lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500">
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-zinc-300">.env.local</span>
              <span className="hidden sm:inline">plaintext · stays on this device</span>
              <span className="sm:hidden">plaintext</span>
            </div>
            <span className="font-mono text-[11px] text-zinc-500">{varCount} vars</span>
          </div>
          <div className="relative flex h-[300px] font-mono text-[12.5px] leading-6" data-lenis-prevent>
            <div aria-hidden className="w-10 shrink-0 select-none pt-2 pr-2 text-right text-zinc-600">
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <div className="relative min-w-0 flex-1">
              <pre ref={preRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden p-2 pr-4 whitespace-pre text-zinc-300">
                {highlight(plain)}
              </pre>
              <textarea
                value={plain}
                onChange={(e) => setPlain(e.target.value)}
                onScroll={(e) => {
                  if (preRef.current) {
                    preRef.current.scrollTop = e.currentTarget.scrollTop;
                    preRef.current.scrollLeft = e.currentTarget.scrollLeft;
                  }
                }}
                spellCheck={false}
                wrap="off"
                aria-label=".env file contents"
                className="absolute inset-0 resize-none overflow-auto bg-transparent p-2 pr-4 whitespace-pre text-transparent caret-volt outline-none focus-visible:outline-none selection:bg-volt/30"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 border-t border-white/[0.06] px-4 py-3">
            <KeyRound className="h-4 w-4 text-zinc-500" />
            <span className="font-mono text-[11px] whitespace-nowrap text-zinc-500">master key</span>
            <input
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              type="password"
              aria-label="Master passphrase"
              className="w-full min-w-0 bg-transparent font-mono text-[12px] text-zinc-200 outline-none focus-visible:outline-none"
            />
          </label>
        </div>

        {/* Output */}
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5 font-mono text-[11px]">
              {(["envelope", "server"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`relative rounded-md px-2.5 py-1 transition-colors ${tab === t ? "text-black" : "text-zinc-400 hover:text-white"}`}
                >
                  {tab === t && <motion.span layoutId="pg-tab" className="absolute inset-0 rounded-md bg-volt" />}
                  <span className="relative">{t === "envelope" ? "envelope.json" : "what the server sees"}</span>
                </button>
              ))}
            </div>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-500">
              <Zap className={`h-3 w-3 ${busy ? "animate-pulse text-volt" : ""}`} /> live
            </span>
          </div>

          <div className="h-[300px] overflow-auto px-4 pb-3 font-mono text-[12px] leading-6" data-lenis-prevent>
            {unsupported ? (
              <p className="pt-6 text-zinc-500">WebCrypto needs a secure context (https or localhost).</p>
            ) : tab === "envelope" ? (
              envelope && (
                <div>
                  <div className="text-zinc-500">{"{"}</div>
                  {(
                    [
                      ["formatVersion", String(envelope.formatVersion), "tok-num"],
                      ["algorithm", `"${envelope.algorithm}"`, "tok-str"],
                      ["keyVersion", String(envelope.keyVersion), "tok-num"],
                      ["nonce", `"${envelope.nonce}"`, "tok-val"],
                      ["ciphertext", `"${envelope.ciphertext.slice(0, 48)}…"`, "tok-val"],
                      ["authTag", `"${envelope.authTag}"`, "tok-val"],
                    ] as const
                  ).map(([k, v, c]) => (
                    <div key={k} className="truncate pl-4">
                      <span className="tok-key">&quot;{k}&quot;</span>
                      <span className="tok-eq">: </span>
                      <motion.span key={`${k}-${pulse}`} initial={{ opacity: 0.2 }} animate={{ opacity: 1 }} className={c}>
                        {v}
                      </motion.span>
                    </div>
                  ))}
                  <div className="text-zinc-500">{"}"}</div>
                  <div className="mt-3 grid grid-cols-[repeat(32,minmax(0,1fr))] gap-[2px]" aria-hidden>
                    {bytes.map((b, i) => (
                      <motion.span
                        key={`${pulse}-${i}`}
                        initial={{ opacity: 0, scale: 0.4 }}
                        animate={{ opacity: 0.25 + (b / 255) * 0.75, scale: 1 }}
                        transition={{ delay: i * 0.004 }}
                        className="aspect-square rounded-[3px]"
                        style={{ background: i % 7 === 0 ? "var(--color-iris)" : "var(--color-volt)" }}
                      />
                    ))}
                  </div>
                  <div className="mt-2 text-[11px] text-zinc-600">
                    {fromB64(envelope.ciphertext).length} B ciphertext · 12 B nonce · 16 B tag · new nonce every keystroke
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-2 pt-1">
                {[
                  ["canonicalRemote", canonical ?? "—"],
                  ["environment", "default"],
                  ["object", "users/{userId}/projects/{projectId}/environments/default/versions/{uuid}"],
                  ["size", envelope ? `${fromB64(envelope.ciphertext).length + 28} B` : "—"],
                  ["plaintext", "never received"],
                  ["your key", "never received"],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2">
                    <span className="w-32 shrink-0 text-zinc-500">{k}</span>
                    <span className={`min-w-0 break-all ${v === "never received" ? "text-volt" : "text-zinc-300"}`}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-auto border-t border-white/[0.06] p-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => tryOpen("normal")}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-[12px] font-semibold text-black transition-transform active:scale-95"
              >
                <Unlock className="h-3.5 w-3.5" /> Decrypt
              </button>
              <button
                onClick={() => tryOpen("tamper")}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[12px] text-zinc-200 hover:border-white/20"
              >
                Flip 1 bit
              </button>
              <button
                onClick={() => tryOpen("wrong-repo")}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[12px] text-zinc-200 hover:border-white/20"
              >
                Open as a fork
              </button>
            </div>
            <AnimatePresence mode="wait">
              {verdict && (
                <motion.div
                  key={verdict.title}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-[12px] ${
                    verdict.kind === "ok" ? "border-volt/30 bg-volt/[0.07] text-volt" : "border-danger/30 bg-danger/[0.07] text-danger"
                  }`}
                >
                  {verdict.kind === "ok" ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span>
                    <span className="font-semibold">{verdict.title}</span>
                    <span className="block text-zinc-400">{verdict.detail}</span>
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
