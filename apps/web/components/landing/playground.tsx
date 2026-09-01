"use client";
import { useState } from "react";
import { Copy, Check, ArrowRight } from "lucide-react";

function normalizeDemo(input: string): string {
  // Simplified demo of normalizeRemote (client-side, no git)
  let s = input.trim();
  if (s.startsWith("git@")) {
    const m = s.match(/^[^@]+@([^:]+):(.+)$/);
    if (m) {
      const host = m[1]!.toLowerCase();
      let p = m[2]!.replace(/\.git\/?$/, "").replace(/^\/+/, "");
      return `${host}/${p}`;
    }
  }
  try {
    if (s.includes("://")) {
      const u = new URL(s);
      return `${u.hostname.toLowerCase()}/${u.pathname.replace(/^\//, "").replace(/\.git\/?$/, "")}`;
    }
  } catch {}
  return s;
}

export function Playground() {
  const [input, setInput] = useState("git@github.com:<username>/<repository>.git");
  const [copied, setCopied] = useState(false);
  const output = normalizeDemo(input);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
        <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><span className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><span className="h-2.5 w-2.5 rounded-full bg-zinc-700" /></div>
        <span className="text-xs text-zinc-500">normalizeRemote — live</span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div>
          <label className="text-xs font-medium tracking-widest text-zinc-500 uppercase">Input (any Git URL)</label>
          <input value={input} onChange={(e) => setInput(e.target.value)} className="mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-white placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none" placeholder="git@github.com:owner/repo.git" />
        </div>
        <div className="hidden justify-center sm:flex"><ArrowRight className="h-4 w-4 text-zinc-600" /></div>
        <div>
          <label className="text-xs font-medium tracking-widest text-zinc-500 uppercase">Canonical</label>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-sm text-white">{output || "—"}</code>
            <button onClick={async () => { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(()=>setCopied(false),1500); }} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-1 text-xs text-zinc-500">provider • host • owner • repository → preserves subgroup</div>
        </div>
      </div>
    </div>
  );
}

export function EncryptPlayground() {
  const [plain, setPlain] = useState("DATABASE_URL=postgres://localhost\nJWT_SECRET=supersecret");
  const [copied, setCopied] = useState(false);
  // Mock ciphertext (not real encrypt, just demo)
  const mock = plain ? `AES-256-GCM v1 • nonce ${plain.length}B • ${btoa(plain).slice(0, 24)}…` : "—";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
        <span className="text-xs font-medium tracking-widest text-zinc-500 uppercase">Encrypt (client-side, never plaintext on server)</span>
        <span className="rounded border border-zinc-700 bg-white px-1.5 py-0.5 text-[10px] font-medium text-black">Ciphertext only</span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div>
          <label className="text-xs text-zinc-500">Plaintext (.env)</label>
          <textarea value={plain} onChange={(e) => setPlain(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 font-mono text-xs text-white placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none" />
        </div>
        <div>
          <label className="text-xs text-zinc-500">Ciphertext (R2 private)</label>
          <div className="mt-1 rounded-md border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs text-zinc-400 break-all">{mock}</div>
          <button onClick={() => { setCopied(true); setTimeout(()=>setCopied(false),1500); }} className="mt-2 text-xs text-zinc-400 hover:text-white">{copied ? "Copied" : "Copy mock"}</button>
        </div>
      </div>
    </div>
  );
}
