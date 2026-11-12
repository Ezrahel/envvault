import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SecurityPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Security</h1>
      <p className="max-w-[640px] text-sm text-zinc-400">Security takes priority over convenience (§2). EnvVault never needs plaintext on the server.</p>
      <div className="grid gap-4">
        <Card>
          <h3 className="font-semibold">Client-Side Encryption</h3>
          <p className="mt-2 text-sm text-zinc-400">Flow: <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-xs">.env plaintext → local AES-256-GCM (12B nonce, auth tag) → ciphertext → HTTPS → API → R2 private signed 900s</code></p>
          <p className="mt-2 text-xs text-zinc-500">Envelope: <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-xs">{"{formatVersion:1, algorithm:\"AES-256-GCM\", keyVersion, nonce,ciphertext,authTag}"}</code> • Key via OS keychain with file fallback + warning.</p>
          <div className="mt-3 flex gap-2">
            <div className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 p-2 text-center text-xs"><div className="text-zinc-500">Plaintext</div><div className="font-mono">.env</div></div>
            <div className="self-center text-zinc-600">→</div>
            <div className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 p-2 text-center text-xs"><div className="text-zinc-500">Ciphertext</div><div className="font-mono">AES-GCM</div></div>
            <div className="self-center text-zinc-600">→</div>
            <div className="flex-1 rounded-md border border-zinc-800 bg-white p-2 text-center text-xs text-black"><div> R2 Private</div></div>
          </div>
        </Card>
        <Card className="border-red-900/30 bg-red-950/20">
          <h3 className="font-semibold text-red-300">What we never do</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-400">
            <li>Never log <code className="bg-zinc-900 px-1 rounded font-mono text-xs">DATABASE_URL</code> / <code className="bg-zinc-900 px-1 rounded font-mono text-xs">JWT_SECRET</code></li>
            <li>Never print secret values to stdout, telemetry, or shell history</li>
            <li>Never execute project code (<code className="bg-zinc-900 px-1 rounded">npm install</code>) during <code className="bg-zinc-900 px-1 rounded">envvault pull</code></li>
            <li>Never silently overwrite <code className="bg-zinc-900 px-1 rounded">.env</code> — default Abort, Backup-then-restore</li>
          </ul>
        </Card>
        <Card>
          <h3 className="font-semibold">Threat Model (§53)</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              { t: "Stolen laptop", d: "OS keychain + session expiry + device revoke" },
              { t: "Compromised server", d: "Only ciphertext in DB/R2" },
              { t: "Malicious CLI", d: "Signed releases, pnpm audit" },
              { t: "Cross-account", d: "userId scoping per §69" },
            ].map((x) => (
              <div key={x.t} className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
                <div className="text-sm font-medium">{x.t}</div>
                <div className="text-xs text-zinc-500">{x.d}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
