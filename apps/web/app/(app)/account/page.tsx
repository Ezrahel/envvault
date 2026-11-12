import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AccountPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Account</h1>
      <p className="max-w-[640px] text-sm text-zinc-400">Manage your EnvVault account. Email + OAuth (GitHub first per §51) with least-privilege permissions.</p>
      <div className="grid gap-4 max-w-[520px]">
        <Card>
          <h3 className="text-sm font-semibold">Profile</h3>
          <p className="mt-2 text-sm text-zinc-400">Email: <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-xs">dev@example.com</code></p>
          <p className="mt-1 text-xs text-zinc-500">Name synced from GitHub OAuth when enabled.</p>
          <div className="mt-3 flex gap-2">
            <Badge>GitHub OAuth → soon</Badge>
            <Badge>MFA → future</Badge>
          </div>
        </Card>
        <Card className="bg-zinc-900/30">
          <h3 className="text-sm font-semibold">Recovery Model (MVP)</h3>
          <p className="mt-2 text-xs leading-5 text-zinc-400">EnvVault uses client-side encryption. If you lose your master key, secrets cannot be recovered (Mode A — Maximum privacy). This is a deliberate tradeoff per §24. Future: encrypted key wrapping (Mode B) and team recovery keys (Mode C).</p>
          <p className="mt-2 text-xs text-zinc-500">Authentication (OAuth token) ≠ Encryption key. Server never sees plaintext.</p>
        </Card>
      </div>
    </div>
  );
}
