import Link from "next/link";
import { Folder, Layers, Laptop, Activity, ArrowRight, Shield, ArrowUpRight } from "lucide-react";
import { fetchProjects } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { PageHeader, Code } from "@/components/ui/page-header";
import { buttonBase, buttonSizes, buttonVariants } from "@/components/ui/button";

export default async function Page() {
  const projects = await fetchProjects();
  const count = projects.length;

  const snippet = `npm install -g envvault
envvault login
envvault scan
envvault push          # old machine
# new machine
git clone git@github.com:you/project.git
cd project && envvault pull`;

  const stats = [
    { href: "/projects", icon: Folder, label: "Projects", value: String(count), hint: "Linked by canonical Git remote" },
    { href: "/environments", icon: Layers, label: "Environments", value: "—", hint: "Versioned, encrypted backups" },
    { href: "/devices", icon: Laptop, label: "Devices", value: "—", hint: "Trusted machines · revoke anytime" },
  ];

  // Illustrative sparkline until push events are exposed by the API.
  const pts = [25, 20, 22, 12, 15, 8, 10, 5, 7, 3, 4];
  const line = pts.map((y, i) => `${i * 10},${y}`).join(" ");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title={
          <>
            Your environment,
            <br className="hidden sm:block" /> on any machine.
          </>
        }
        description={
          <>
            EnvVault discovers <Code>.env</Code> files, links them to Git repositories, encrypts them client-side with AES-256-GCM, and restores
            them with <Code>envvault pull</Code>.
          </>
        }
        actions={
          <>
            <Link href="/projects" className={`${buttonBase} ${buttonVariants.primary} ${buttonSizes.md}`}>
              View projects <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/security" className={`${buttonBase} ${buttonVariants.secondary} ${buttonSizes.md}`}>
              <Shield className="h-3.5 w-3.5" /> Security
            </Link>
          </>
        }
      />

      {/* Status strip */}
      <div className="glass flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl px-5 py-3 font-mono text-xs">
        <span className="inline-flex items-center gap-2 text-zinc-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-volt" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-volt" />
          </span>
          API online
        </span>
        <span className="text-zinc-500">
          cipher <span className="text-zinc-300">AES-256-GCM</span>
        </span>
        <span className="text-zinc-500">
          storage <span className="text-zinc-300">ciphertext only</span>
        </span>
        <span className="text-zinc-500 sm:ml-auto">
          projects <span className="text-volt">{count}</span>
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="spotlight relative h-full overflow-hidden hover:border-white/15">
              <div aria-hidden className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-volt/0 blur-3xl transition-colors duration-500 group-hover:bg-volt/10" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-sm font-medium">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
                    <s.icon className="h-4 w-4 text-volt" />
                  </span>
                  {s.label}
                </div>
                <ArrowUpRight className="h-4 w-4 text-zinc-600 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
              </div>
              <div className="mt-5 text-4xl font-semibold tracking-tight">{s.value}</div>
              <div className="mt-1 text-xs text-zinc-500">{s.hint}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-volt" /> Activity: pushes, last 7 days
            </h3>
            <Badge variant="volt">Encrypted</Badge>
          </div>
          <div className="mt-5 h-[120px] w-full">
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-full w-full overflow-visible">
              <defs>
                <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#c6ff4a" stopOpacity="0.28" />
                  <stop offset="1" stopColor="#c6ff4a" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="spark-line" x1="0" x2="1">
                  <stop offset="0" stopColor="#8b7cff" />
                  <stop offset="1" stopColor="#c6ff4a" />
                </linearGradient>
              </defs>
              {[7.5, 15, 22.5].map((y) => (
                <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" />
              ))}
              <polygon fill="url(#spark-fill)" points={`${line} 100,30 0,30`} />
              <polyline fill="none" stroke="url(#spark-line)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" points={line} />
            </svg>
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] text-zinc-600">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold">Recent projects</h3>
          <p className="text-xs text-zinc-500">Most recently linked</p>
          <div className="mt-4 space-y-2">
            {count > 0 ? (
              projects.slice(0, 4).map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 transition-colors hover:border-white/15"
                >
                  <span className="truncate font-mono text-xs text-zinc-200">{p.canonicalRemote}</span>
                  <span className="shrink-0 font-mono text-[11px] text-zinc-500">{new Date(p.createdAt).toLocaleDateString()}</span>
                </Link>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-xs text-zinc-500">
                No pushes yet. Run <Code>envvault push</Code>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <h3 className="ml-2 text-sm font-semibold">Get started</h3>
          </div>
          <CopyButton text={snippet} />
        </div>
        <pre className="overflow-auto p-5 font-mono text-[13px] leading-6 text-zinc-300">
          {snippet.split("\n").map((l, i) => (
            <div key={i} className={l.startsWith("#") ? "text-zinc-600" : ""}>
              {!l.startsWith("#") && <span className="mr-2 text-volt">$</span>}
              {l}
            </div>
          ))}
        </pre>
        <p className="border-t border-white/[0.06] px-5 py-3 text-xs text-zinc-500">
          The CLI is the core. The dashboard shows metadata only; secret values are never displayed.{" "}
          <Link href="/security" className="text-zinc-300 underline decoration-white/20 underline-offset-4 hover:text-volt">
            Security model
          </Link>
        </p>
      </Card>
    </div>
  );
}
