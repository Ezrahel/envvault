"use client";
import { useState, useMemo } from "react";
import { Search, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Empty, EmptySearch } from "./ui/empty";

const PROVIDER_DOT: Record<string, string> = {
  github: "bg-white",
  gitlab: "bg-[#fc6d26]",
  bitbucket: "bg-[#2684ff]",
};

export function ProjectsTable({
  projects,
}: {
  projects: Array<{ id: string; canonicalRemote: string; provider: string; host: string; owner?: string; repository: string; createdAt: string }>;
}) {
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState("all");
  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        if (provider !== "all" && p.provider !== provider) return false;
        if (q && !p.canonicalRemote.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [projects, q, provider],
  );

  if (projects.length === 0) {
    return (
      <Empty
        title="No projects yet"
        description="Run envvault push from inside a Git repository. Projects are identified by their canonical Git remote, not the folder name."
        action={{ label: "Read the security model", href: "/security" }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-[340px]">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-zinc-500" />
          <Input placeholder="Filter by remote…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-white/10 bg-black/30 p-0.5 text-xs">
            {["all", "github", "gitlab", "bitbucket", "unknown"].map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`relative rounded-lg px-2.5 py-1.5 capitalize transition-colors ${provider === p ? "text-black" : "text-zinc-400 hover:text-white"}`}
              >
                {provider === p && <motion.span layoutId="provider-pill" className="absolute inset-0 rounded-lg bg-volt" />}
                <span className="relative">{p}</span>
              </button>
            ))}
          </div>
          <span className="font-mono text-xs text-zinc-500">
            {filtered.length}/{projects.length}
          </span>
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptySearch onClear={() => { setQ(""); setProvider("all"); }} />
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="hidden grid-cols-[1fr_auto] gap-2 border-b border-white/[0.06] px-5 py-2.5 font-mono text-[10px] tracking-[0.2em] text-zinc-500 uppercase sm:grid">
            <span>Project</span>
            <span>Created</span>
          </div>
          {filtered.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
              <Link
                href={`/projects/${p.id}`}
                className="group flex items-center justify-between gap-3 border-b border-white/[0.04] px-5 py-3.5 transition-colors last:border-0 hover:bg-white/[0.03]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${PROVIDER_DOT[p.provider] ?? "bg-zinc-600"}`} />
                    <span className="truncate font-mono text-sm text-white">{p.canonicalRemote}</span>
                    <Badge variant="volt">Encrypted</Badge>
                  </div>
                  <div className="mt-1 pl-[18px] text-xs text-zinc-500">
                    {p.host} · {p.owner ? `${p.owner}/` : ""}
                    {p.repository}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden font-mono text-xs text-zinc-500 sm:block">{new Date(p.createdAt).toLocaleDateString()}</span>
                  <ChevronRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-volt" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
