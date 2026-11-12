import { DocShell, DocSection } from "@/components/site/doc-shell";
import { Code } from "@/components/ui/page-header";

export default function PrivacyPage() {
  return (
    <DocShell eyebrow="Privacy policy" title="We never see your secrets." lead="Last updated: August 2026. EnvVault is privacy-first by construction, not by promise.">
      <div className="space-y-4">
        <DocSection n="01" title="What we collect">
          <ul className="space-y-1.5">
            <li><span><span className="text-white">Account:</span> email, GitHub username (if OAuth), device name and platform.</span></li>
            <li><span><span className="text-white">Metadata:</span> canonical Git remote (e.g. <Code>github.com/owner/repo</Code>), environment and file names, version count, timestamps.</span></li>
            <li><span><span className="text-white">Ciphertext:</span> the encrypted env file (AES-256-GCM), stored in private object storage, never plaintext.</span></li>
            <li><span><span className="text-white">Audit:</span> action, project ID, device ID and a truncated IP hash. Never secret values.</span></li>
          </ul>
        </DocSection>
        <DocSection n="02" title="What we never collect">
          <ul className="space-y-1.5">
            <li><span>Secret values (<Code>DATABASE_URL</Code> etc.). They are encrypted client-side before upload.</span></li>
            <li><span>File contents beyond ciphertext. The server cannot decrypt.</span></li>
            <li><span>Your full IP address. We store a hash only.</span></li>
          </ul>
        </DocSection>
        <DocSection n="03" title="Scanning">
          <p>
            EnvVault scans only directories you configure (<Code>~/Projects</Code>, or <Code>--path</Code>). It never scans the whole filesystem by
            default, and you can inspect everything before upload with <Code>backup --dry-run</Code>.
          </p>
        </DocSection>
        <DocSection n="04" title="Contact">
          <p>
            Questions: <Code>security@yourdomain</Code> · Data deletion: <Code>privacy@yourdomain</Code>
          </p>
        </DocSection>
      </div>
    </DocShell>
  );
}
