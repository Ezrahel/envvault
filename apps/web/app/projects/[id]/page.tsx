import { fetchProjects } from "../../../lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import Link from "next/link";

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projects = await fetchProjects();
  const p = projects.find((x) => x.id === id);
  if (!p) return <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-400">Project not found. Check that API is running and you are authenticated. ID: <span className="font-mono text-white">{id}</span></div>;
  const clone = `git clone git@${p.host}:${p.owner}/${p.repository}.git
cd ${p.repository}
envvault pull
npm install && npm run dev`;
  return (
    <div className="space-y-4">
      <Link href="/projects" className="text-xs text-zinc-500 hover:text-white">← Projects</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-tight">{p.canonicalRemote}</h1>
          <p className="mt-1 text-xs text-zinc-500">{p.provider} • {p.host} • {p.owner}/{p.repository} • {new Date(p.createdAt).toLocaleString()}</p>
        </div>
        <Badge>Encrypted</Badge>
      </div>
      <div className="flex gap-2 border-b border-zinc-800 text-sm">
        <span className="border-b border-white pb-2 text-white">Overview</span>
        <span className="pb-2 text-zinc-500">Environments</span>
        <span className="pb-2 text-zinc-500">Versions</span>
        <span className="pb-2 text-zinc-500">Devices</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold">Environments</h3>
          <p className="mt-1 text-xs text-zinc-500">Use <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-xs">envvault push</code> / <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-xs">pull</code> inside the repo. Files are encrypted locally with AAD = canonicalRemote.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[".env",".env.local",".env.production"].map(f=> <span key={f} className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-400">{f}</span>)}
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold">Stats</h3>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div><div className="text-lg font-bold">3</div><div className="text-[11px] text-zinc-500">Envs</div></div>
            <div><div className="text-lg font-bold">8</div><div className="text-[11px] text-zinc-500">Vars</div></div>
            <div><div className="text-lg font-bold">2h</div><div className="text-[11px] text-zinc-500">Ago</div></div>
          </div>
        </Card>
      </div>
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Clone & restore</h3>
          <CopyButton text={clone} />
        </div>
        <pre className="mt-3 overflow-auto rounded-md border border-zinc-800 bg-black p-3 font-mono text-xs leading-5 text-zinc-300">{clone}</pre>
      </Card>
    </div>
  );
}
