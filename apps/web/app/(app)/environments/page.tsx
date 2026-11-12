import { FileKey2 } from "lucide-react";
import { fetchProjects } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Code, Note } from "@/components/ui/page-header";
import { Empty } from "@/components/ui/empty";

const EXAMPLES = [
  { name: "development", file: ".env.local", vars: 8, project: "github.com/acme/web" },
  { name: "staging", file: ".env.staging", vars: 12, project: "github.com/acme/web" },
  { name: "production", file: ".env.production", vars: 14, project: "github.com/acme/api" },
];

export default async function EnvironmentsPage() {
  const projects = await fetchProjects();
  const hasProjects = projects.length > 0;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Environments"
        title="Environments"
        description={
          <>
            Each project can hold several environments: <Code>Project → Environment → File → Versions</Code>. Roll back a bad push with{" "}
            <Code>envvault pull --at-version 2</Code>.
          </>
        }
      />

      {!hasProjects ? (
        <Empty icon={FileKey2} title="No projects yet" description="Push an environment first. It will show up here grouped by project." />
      ) : (
        <div className="grid gap-3">
          {projects.slice(0, 3).map((p) => (
            <Card key={p.id}>
              <div className="font-mono text-sm text-zinc-200">{p.canonicalRemote}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {["development", "staging", "production"].map((env) => (
                  <span key={env} className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-xs text-zinc-400">
                    {env}
                  </span>
                ))}
              </div>
              <div className="mt-3 text-xs text-zinc-500">Variable counts are metadata; values are never shown.</div>
            </Card>
          ))}
        </div>
      )}

      <div>
        <div className="mb-3 font-mono text-[10px] tracking-[0.2em] text-zinc-500 uppercase">{hasProjects ? "Files" : "Example layout"}</div>
        <div className="grid gap-3">
          {EXAMPLES.map((e) => (
            <Card key={e.file + e.project} className={`flex flex-wrap items-center justify-between gap-3 ${!hasProjects ? "opacity-60" : ""}`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <FileKey2 className="h-4 w-4 text-volt" />
                </span>
                <div className="min-w-0">
                  <div className="font-mono text-sm font-medium">
                    {e.file} <span className="font-sans text-xs font-normal text-zinc-500">· {e.project}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {e.name} · {e.vars} variables · <span className="text-white">v3</span>
                  </div>
                </div>
              </div>
              <Badge variant="volt">Encrypted</Badge>
            </Card>
          ))}
        </div>
      </div>

      <Note>
        Use <Code>envvault diff</Code> to see added, removed and changed keys. Values stay hidden.
      </Note>
    </div>
  );
}
