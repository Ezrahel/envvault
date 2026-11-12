import Link from "next/link";
import { ArrowLeft, FileKey2 } from "lucide-react";
import { fetchProjects } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { Code } from "@/components/ui/page-header";
import { Empty } from "@/components/ui/empty";

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projects = await fetchProjects();
  const p = projects.find((x) => x.id === id);
  if (!p) {
    return (
      <Empty
        title="Project not found"
        description={
          <>
            Check that the API is running and you are authenticated. ID: <span className="font-mono text-white">{id}</span>
          </>
        }
        action={{ label: "Back to projects", href: "/projects" }}
      />
    );
  }
  const clone = `git clone git@${p.host}:${p.owner}/${p.repository}.git
cd ${p.repository}
envvault pull
npm install && npm run dev`;

  return (
    <div className="space-y-6">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Projects
      </Link>

      <div className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div aria-hidden className="absolute -top-20 -right-10 h-60 w-60 rounded-full bg-iris/20 blur-[90px]" />
        <div aria-hidden className="bg-grid absolute inset-0 opacity-50 [mask-image:linear-gradient(to_left,#000,transparent_60%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-[11px] tracking-[0.2em] text-volt uppercase">{p.provider}</div>
            <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight break-all sm:text-3xl">{p.canonicalRemote}</h1>
            <p className="mt-2 text-xs text-zinc-500">
              {p.host} · {p.owner}/{p.repository} · linked {new Date(p.createdAt).toLocaleString()}
            </p>
          </div>
          <Badge variant="volt">Encrypted</Badge>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06] text-sm">
        {["Overview", "Environments", "Versions", "Devices"].map((t, i) => (
          <span
            key={t}
            className={`-mb-px border-b-2 px-3 pb-2.5 whitespace-nowrap ${i === 0 ? "border-volt text-white" : "border-transparent text-zinc-500"}`}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold">Environment files</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Use <Code>envvault push</Code> / <Code>pull</Code> inside the repo. Files are encrypted locally with AAD = canonical remote.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[".env", ".env.local", ".env.production"].map((f) => (
              <span key={f} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 font-mono text-xs text-zinc-300">
                <FileKey2 className="h-3.5 w-3.5 text-volt" /> {f}
              </span>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold">Stats</h3>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              ["3", "envs"],
              ["8", "vars"],
              ["v3", "latest"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-xl border border-white/[0.06] bg-black/20 p-3 text-center">
                <div className="text-xl font-semibold">{v}</div>
                <div className="font-mono text-[10px] tracking-wider text-zinc-500 uppercase">{l}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
          <h3 className="text-sm font-semibold">Clone & restore</h3>
          <CopyButton text={clone} />
        </div>
        <pre className="overflow-auto p-5 font-mono text-[13px] leading-6 text-zinc-300">
          {clone.split("\n").map((l) => (
            <div key={l}>
              <span className="mr-2 text-volt">$</span>
              {l}
            </div>
          ))}
        </pre>
      </Card>
    </div>
  );
}
