import { KeyRound, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Code } from "@/components/ui/page-header";

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="Account" description="Email and OAuth sign-in (GitHub first) with least-privilege permissions." />
      <div className="grid max-w-[880px] gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-iris text-lg font-semibold text-black">A</span>
            <div>
              <h3 className="text-sm font-semibold">Profile</h3>
              <p className="text-xs text-zinc-500">Synced from GitHub OAuth when enabled</p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 text-sm">
            <User className="h-4 w-4 text-zinc-500" />
            <Code>dev@example.com</Code>
          </div>
          <div className="mt-4 flex gap-2">
            <Badge>GitHub OAuth · soon</Badge>
            <Badge>MFA · future</Badge>
          </div>
        </Card>
        <Card className="relative overflow-hidden">
          <div aria-hidden className="absolute -right-12 -bottom-12 h-40 w-40 rounded-full bg-iris/15 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-volt" />
              <h3 className="text-sm font-semibold">Recovery model</h3>
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-400">
              EnvVault uses client-side encryption. If you lose your master key, secrets cannot be recovered. This is a deliberate trade-off for
              maximum privacy. Encrypted key wrapping and team recovery keys are planned.
            </p>
            <p className="mt-3 text-xs text-zinc-500">Authentication token ≠ encryption key. The server never sees plaintext.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
