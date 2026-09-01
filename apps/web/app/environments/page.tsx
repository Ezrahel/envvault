import { fetchProjects } from "../../lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function EnvironmentsPage() {
  const projects = await fetchProjects();
  const hasProjects = projects.length > 0;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Environments</h1>
      <p className="max-w-[640px] text-sm text-zinc-400">Each project can have multiple environments. EnvVault models <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-xs">Project → Environment → EnvironmentFile → Versions</code>. Version history lets you <code className="bg-zinc-900 px-1 rounded font-mono text-xs">envvault restore --at-version 2</code> after a bad push.</p>
      {!hasProjects ? (
        <Card className="text-center py-8"><p className="text-sm text-zinc-500">No projects yet. Push an environment first.</p></Card>
      ) : (
        <div className="grid gap-3">
          {projects.slice(0, 3).map((p) => (
            <Card key={p.id}>
              <div className="font-mono text-xs text-zinc-400">{p.canonicalRemote}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {["development","staging","production"].map((env) => (
                  <span key={env} className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-400">{env}</span>
                ))}
              </div>
              <div className="mt-2 text-xs text-zinc-500">Files: .env, .env.local, .env.production • 8-14 variables (count only, never values)</div>
            </Card>
          ))}
        </div>
      )}
      <div className="grid gap-3">
        {[
          { name: "development", file: ".env.local", vars: 8, project: "github.com/<username>/<repository>" },
          { name: "staging", file: ".env.staging", vars: 12, project: "github.com/<username>/<repository>" },
          { name: "production", file: ".env.production", vars: 14, project: "github.com/<username>/aorahq" },
        ].map((e) => (
          <Card key={e.file+e.project} className={`flex items-center justify-between ${!hasProjects ? "opacity-60" : ""}`}>
            <div>
              <div className="font-mono text-sm font-medium">{e.file} <span className="font-sans text-xs font-normal text-zinc-500">• {e.project}</span></div>
              <div className="mt-1 text-xs text-zinc-500">{e.name} • {e.vars} variables • last updated — • <span className="text-white">v3</span></div>
            </div>
            <Badge>Encrypted</Badge>
          </Card>
        ))}
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">Variable counts are metadata only. Use <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-xs">envvault diff</code> to see Added/Removed/Changed keys (values hidden).</div>
    </div>
  );
}
