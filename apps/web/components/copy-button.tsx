"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
        copied ? "border-volt/40 bg-volt/10 text-volt" : "border-white/10 bg-white/[0.04] text-zinc-400 hover:border-white/20 hover:text-white"
      }`}
      aria-label={copied ? "Copied" : "Copy"}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
