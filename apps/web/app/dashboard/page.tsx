import { fetchProjects } from "../../lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { Folder, Layers, Laptop, Activity, ArrowRight, Shield } from "lucide-react";
import Link from "next/link";

export default async function Page() {
  const projects = await fetchProjects();
  const count = projects.length;

  const snippet = `npm install -g envvault
envvault login
envvault scan
envvault push   # old machine
# new machine
git clone git@github.com:you/project.git
cd project
envvault pull`;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-[640px]">
          <h1 className="text-[32px] font-bold leading-[1.1] tracking-tight">Your development environment,<br />available on any machine.</h1>
          <p className="mt-3 max-w-[600px] text-sm leading-5 text-zinc-400">
            EnvVault discovers <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-xs text-zinc-300">.env</code> files, links them to Git repositories (not folder names), encrypts client-side with AES-256-GCM, and restores them with <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-xs text-zinc-300">envvault pull</code>. Clone. Pull. Run.
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/projects"><Button variant="primary" size="md">View Projects <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></Link>
            <a href="/security" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"><Shield className="h-3.5 w-3.5" /> Security</a>
          </div>
        </div>
        <Card className="min-w-[220px] p-3">
          <div className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">Status</div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-zinc-500">Projects</span><span className="font-mono font-medium text-white">{count}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">API</span><span className="inline-flex items-center gap-1.5 text-white"><span className="h-2 w-2 rounded-full bg-white" /> online</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Cipher</span><span className="text-zinc-300">AES-256-GCM</span></div>
          </div>
          <div className="mt-3 border-t border-zinc-800 pt-2 text-[11px] text-zinc-500">Ciphertext only on server • never plaintext</div>
        </Card>
      </div>

      {/* Stats 3 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/projects" className="group">
          <Card className="group-hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold"><Folder className="h-4 w-4 text-zinc-500" /> Projects</div>
              <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-white" />
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight">{count}</div>
            <div className="text-xs text-zinc-500">Linked via canonical Git remote</div>
            <div className="mt-2 text-[11px] text-zinc-600">e.g. github.com/{'<'}username{'>'}/{'<'}repository{'>'}</div>
          </Card>
        </Link>
        <Link href="/environments">
          <Card className="hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4 text-zinc-500" /> Environments</div>
            <div className="mt-3 text-3xl font-bold">—</div>
            <div className="text-xs text-zinc-500">Versioned, encrypted backups</div>
            <div className="mt-2 text-[11px] text-zinc-600">.env.local • staging • production</div>
          </Card>
        </Link>
        <Link href="/devices">
          <Card className="hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-2 text-sm font-semibold"><Laptop className="h-4 w-4 text-zinc-500" /> Devices</div>
            <div className="mt-3 text-3xl font-bold">—</div>
            <div className="text-xs text-zinc-500">Trusted machines</div>
            <div className="mt-2 text-[11px] text-zinc-600">Revoke anytime • lastSeen</div>
          </Card>
        </Link>
      </div>

      {/* Activity + Recent */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-zinc-500" /> Activity — pushes 7d</h3>
            <Badge>Encrypted</Badge>
          </div>
          <div className="mt-4 h-[80px] w-full rounded-md border border-zinc-800 bg-zinc-950 p-2">
            {/* Grayscale sparkline (no Recharts for now, simple SVG) */}
            <svg viewBox="0 0 100 30" className="h-full w-full">
              <polyline fill="none" stroke="#a1a1aa" strokeWidth="1.5" points="0,25 10,20 20,22 30,12 40,15 50,8 60,10 70,5 80,7 90,3 100,4" />
              <polyline fill="#27272a" fillOpacity="0.3" stroke="none" points="0,25 10,20 20,22 30,12 40,15 50,8 60,10 70,5 80,7 90,3 100,4 100,30 0,30" />
            </svg>
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-zinc-500"><span>Mon</span><span>Sun</span></div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold">Recent pushes</h3>
          <p className="text-xs text-zinc-500">Last 3 projects with pushes</p>
          <div className="mt-3 space-y-2">
            {count > 0 ? projects.slice(0, 3).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border border-zinc-800 bg-[#0a0a0a] px-2.5 py-2">
                <span className="font-mono text-xs text-zinc-300 truncate">{p.canonicalRemote}</span>
                <span className="text-[11px] text-zinc-500">2h ago</span>
              </div>
            )) : <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-950 px-3 py-4 text-center text-xs text-zinc-500">No pushes yet — run <code className="bg-zinc-900 px-1 rounded">envvault push</code></div>}
          </div>
        </Card>
      </div>

      {/* Get started */}
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Get started</h3>
          <CopyButton text={snippet} />
        </div>
        <pre className="mt-3 overflow-auto rounded-md border border-zinc-800 bg-black p-3 text-xs leading-5 text-zinc-300">{snippet}</pre>
        <p className="mt-2 text-xs text-zinc-500">CLI is the core. Dashboard shows metadata only — secret values are never displayed. <Link href="/security" className="underline decoration-zinc-700 underline-offset-4 hover:text-zinc-300">Security model</Link></p>
      </Card>
    </div>
  );
}
