import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function VersionsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Version History</h1>
      <p className="max-w-[640px] text-sm text-zinc-400">Every <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-xs">envvault push</code> creates a version (v1, v2, v3…). Restore any version with <code className="bg-zinc-900 px-1 rounded font-mono text-xs">envvault pull --at-version 2</code>. Atomic, audited.</p>
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-[80px_1fr_140px_120px] gap-2 border-b border-zinc-800 bg-zinc-900/50 px-4 py-2 text-[11px] font-medium tracking-widest text-zinc-500 uppercase">
          <span>Version</span><span>File</span><span>Created</span><span>Cipher</span>
        </div>
        {[
          { v: 3, file: ".env.local", time: "2 hours ago", algo: "AES-256-GCM v1" },
          { v: 2, file: ".env.local", time: "1 day ago", algo: "AES-256-GCM v1" },
          { v: 1, file: ".env.local", time: "3 days ago", algo: "AES-256-GCM v1" },
        ].map((r) => (
          <div key={r.v} className="grid grid-cols-[80px_1fr_140px_120px] items-center border-b border-zinc-800 px-4 py-3 text-sm last:border-0 hover:bg-zinc-900">
            <span className="font-mono text-sm"><span className={r.v===3 ? "text-white" : "text-zinc-400"}>v{r.v}</span> {r.v===3 && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-white" />}</span>
            <span className="font-mono text-sm">{r.file}</span>
            <span className="text-xs text-zinc-500">{r.time}</span>
            <Badge>{r.algo}</Badge>
          </div>
        ))}
      </Card>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">Versions store ciphertext only. <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-xs">users/{"{userId}"}/projects/{"{projectId}"}/environments/{"{env}"}/versions/{"{versionId}"}</code> — no secret in name (§67). Signed URLs expire in 15 min (§68).</div>
      <div className="hidden sm:block rounded-lg border border-zinc-800 bg-zinc-950 p-3 sm:hidden">
        <p className="text-xs text-zinc-500">On mobile, table stacks. Use horizontal scroll.</p>
      </div>
    </div>
  );
}
