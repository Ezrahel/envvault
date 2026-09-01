import { Card } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-[720px] space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="text-sm text-zinc-400">Last updated: August 2026</p>
      <Card>
        <h3 className="font-semibold">1. Service</h3>
        <p className="mt-2 text-sm text-zinc-400">EnvVault provides project-aware encrypted backup/restore for <code className="bg-zinc-900 px-1 rounded">.env</code> files. CLI is core; web manages metadata, not plaintext. Free/Pro/Team tiers per pricing.</p>
      </Card>
      <Card>
        <h3 className="font-semibold">2. Acceptable use</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-400">
          <li>No abuse of rate limits (100/min, higher for migration with auth)</li>
          <li>No attempt to decrypt others’ ciphertext</li>
          <li>Private repos: ensure you have right to backup env</li>
        </ul>
      </Card>
      <Card>
        <h3 className="font-semibold">3. No warranty / Limitation</h3>
        <p className="mt-2 text-sm text-zinc-400">Recovery Mode A: if you lose master key, secrets are unrecoverable by design. Backups are provided as-is. RPO 24h / RTO 4h targets (improved over time).</p>
      </Card>
      <Card>
        <h3 className="font-semibold">4. Termination</h3>
        <p className="text-sm text-zinc-400">We may revoke devices/tokens for abuse. You may `logout` and delete vault via `env delete` (type DELETE).</p>
      </Card>
      <Card>
        <h3 className="font-semibold">Contact</h3>
        <p className="text-sm text-zinc-400"><code className="bg-zinc-900 px-1 rounded">legal@yourdomain</code> • <code className="bg-zinc-900 px-1 rounded">support@yourdomain</code></p>
      </Card>
    </div>
  );
}
