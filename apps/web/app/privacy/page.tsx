import { Card } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[720px] space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="text-sm text-zinc-400">Last updated: August 2026 • EnvVault is privacy-first. We never see your secrets.</p>
      <Card>
        <h3 className="font-semibold">What we collect</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-400">
          <li><span className="text-white">Account:</span> email, GitHub username (if OAuth), device name/platform</li>
          <li><span className="text-white">Metadata:</span> canonical Git remote (e.g., <code className="bg-zinc-900 px-1 rounded">github.com/owner/repo</code>), environment/file names, version count, timestamps</li>
          <li><span className="text-white">Ciphertext:</span> encrypted env file (AES-256-GCM) — stored in private R2/S3, never plaintext</li>
          <li><span className="text-white">Audit:</span> action, projectId, deviceId, IP hash (sha256 slice), never secret values</li>
        </ul>
      </Card>
      <Card>
        <h3 className="font-semibold">What we never collect</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-400">
          <li>Secret values (<code className="bg-zinc-900 px-1 rounded">DATABASE_URL</code> etc.) — encrypted client-side before upload</li>
          <li>File contents beyond ciphertext — server cannot decrypt</li>
          <li>Full IP — only hash, never raw</li>
        </ul>
      </Card>
      <Card>
        <h3 className="font-semibold">Scanning</h3>
        <p className="mt-2 text-sm text-zinc-400">EnvVault scans only directories you configure (<code className="bg-zinc-900 px-1 rounded">~/Projects</code> etc., or <code className="bg-zinc-900 px-1 rounded">--path</code>). It never scans the entire filesystem by default. You inspect before upload (<code className="bg-zinc-900 px-1 rounded">backup --dry-run</code>).</p>
      </Card>
      <Card>
        <h3 className="font-semibold">Contact</h3>
        <p className="text-sm text-zinc-400">Questions: <code className="bg-zinc-900 px-1 rounded">security@yourdomain</code> • Data deletion: <code className="bg-zinc-900 px-1 rounded">privacy@yourdomain</code></p>
      </Card>
    </div>
  );
}
