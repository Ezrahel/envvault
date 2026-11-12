import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Code, Note } from "@/components/ui/page-header";

const ROWS = [
  { v: 3, file: ".env.local", time: "2 hours ago", algo: "AES-256-GCM v1" },
  { v: 2, file: ".env.local", time: "1 day ago", algo: "AES-256-GCM v1" },
  { v: 1, file: ".env.local", time: "3 days ago", algo: "AES-256-GCM v1" },
];

export default function VersionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="History"
        title="Version history"
        description={
          <>
            Every <Code>envvault push</Code> creates a version. Restore any of them with <Code>envvault pull --at-version 2</Code>. Atomic and
            audited.
          </>
        }
      />

      <Card className="p-6">
        <div className="relative pl-8">
          <div className="absolute top-3 bottom-3 left-[11px] w-px bg-gradient-to-b from-volt via-iris/50 to-transparent" />
          <div className="space-y-3">
            {ROWS.map((r, i) => (
              <div
                key={r.v}
                className={`relative flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-colors ${
                  i === 0 ? "border-volt/25 bg-volt/[0.04]" : "border-white/[0.06] bg-black/20 hover:border-white/15"
                }`}
              >
                <span
                  className={`absolute top-1/2 -left-[26px] h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[var(--bg)] ${
                    i === 0 ? "bg-volt shadow-[0_0_12px_var(--color-volt)]" : "bg-zinc-700"
                  }`}
                />
                <div className="flex items-center gap-4">
                  <span className={`font-mono text-lg font-semibold ${i === 0 ? "text-white" : "text-zinc-400"}`}>v{r.v}</span>
                  <span className="font-mono text-sm text-zinc-300">{r.file}</span>
                  {i === 0 && <Badge variant="volt">latest</Badge>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">{r.time}</span>
                  <Badge>{r.algo}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Note>
        Versions store ciphertext only, at <Code>{"users/{userId}/projects/{projectId}/environments/{env}/versions/{versionId}"}</Code>. No
        secret ever appears in an object name, and signed URLs expire after 15 minutes.
      </Note>
    </div>
  );
}
