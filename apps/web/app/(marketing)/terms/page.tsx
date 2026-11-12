import { DocShell, DocSection } from "@/components/site/doc-shell";
import { Code } from "@/components/ui/page-header";

export default function TermsPage() {
  return (
    <DocShell eyebrow="Terms of service" title="The fine print, kept short." lead="Last updated: August 2026">
      <div className="space-y-4">
        <DocSection n="01" title="Service">
          <p>
            EnvVault provides project-aware, encrypted backup and restore for <Code>.env</Code> files. The CLI is the core; the web app manages
            metadata, never plaintext. Free, Pro and Team tiers are described on the pricing page.
          </p>
        </DocSection>
        <DocSection n="02" title="Acceptable use">
          <ul className="space-y-1.5">
            <li><span>Don&apos;t abuse rate limits (100/min; higher for authenticated migrations).</span></li>
            <li><span>Don&apos;t attempt to decrypt anyone else&apos;s ciphertext.</span></li>
            <li><span>For private repos, make sure you have the right to back up their environment.</span></li>
          </ul>
        </DocSection>
        <DocSection n="03" title="No warranty / limitation">
          <p>
            Recovery Mode A: if you lose your master key, secrets are unrecoverable by design. Backups are provided as-is, with RPO 24h / RTO 4h
            targets that will improve over time.
          </p>
        </DocSection>
        <DocSection n="04" title="Termination">
          <p>
            We may revoke devices or tokens for abuse. You may <Code>logout</Code> and delete your vault with <Code>env delete</Code> (type DELETE to
            confirm).
          </p>
        </DocSection>
        <DocSection n="05" title="Contact">
          <p>
            <Code>legal@yourdomain</Code> · <Code>support@yourdomain</Code>
          </p>
        </DocSection>
      </div>
    </DocShell>
  );
}
