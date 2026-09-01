"use client";
import { useState, useMemo } from "react";
import { Search, ChevronRight } from "lucide-react";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Empty, EmptySearch } from "./ui/empty";
import Link from "next/link";

export function ProjectsTable({ projects }: { projects: Array<{ id: string; canonicalRemote: string; provider: string; host: string; owner?: string; repository: string; createdAt: string }> }) {
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState("all");
  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (provider !== "all" && p.provider !== provider) return false;
      if (q && !p.canonicalRemote.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [projects, q, provider]);

  if (projects.length === 0) {
    return <Empty title="No projects yet" description="Run envvault push from inside a Git repository. Projects are identified by canonical Git remote, not folder name." action={{ label: "View docs", href: "/security" }} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-[320px]">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-zinc-500" />
          <Input placeholder="Filter by canonicalRemote…" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-300">
            <option value="all">All providers</option>
            <option value="github">GitHub</option>
            <option value="gitlab">GitLab</option>
            <option value="bitbucket">Bitbucket</option>
            <option value="unknown">Unknown</option>
          </select>
          <span className="text-xs text-zinc-500">{filtered.length} / {projects.length}</span>
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptySearch onClear={() => { setQ(""); setProvider("all"); }} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
          <div className="hidden grid-cols-[1fr_auto] gap-2 border-b border-zinc-800 bg-zinc-900/50 px-4 py-2 text-[11px] font-medium tracking-widest text-zinc-500 uppercase sm:grid">
            <span>Project</span><span>Updated</span>
          </div>
          {filtered.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 last:border-0 hover:bg-zinc-900">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${p.provider === "github" ? "bg-white" : "bg-zinc-600"}`} />
                  <span className="truncate font-mono text-sm text-white">{p.canonicalRemote}</span>
                  <Badge>Encrypted</Badge>
                </div>
                <div className="mt-1 text-xs text-zinc-500">{p.host} • {p.owner ? `${p.owner}/` : ""}{p.repository} • {new Date(p.createdAt).toLocaleDateString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden text-xs text-zinc-500 sm:block">{new Date(p.createdAt).toLocaleString()}</span>
                <ChevronRight className="h-4 w-4 text-zinc-600" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
