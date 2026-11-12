import { FileKey2, KeyRound, Laptop, Lock, PackageCheck, Server, ShieldOff, Users, Vault } from "lucide-react";
import { DocShell } from "@/components/site/doc-shell";
import { Code } from "@/components/ui/page-header";
import { CipherCube } from "@/components/landing/visuals";
import { Reveal } from "@/components/landing/primitives";

const FLOW = [
  { icon: FileKey2, t: ".env", d: "plaintext, your disk" },
  { icon: KeyRound, t: "scrypt", d: "key from keychain" },
  { icon: Lock, t: "AES-256-GCM", d: "12 B nonce · AAD · tag" },
  { icon: Server, t: "HTTPS → API", d: "ciphertext only" },
  { icon: Vault, t: "Private storage", d: "signed URLs, 900 s" },
];

const THREATS = [
  { icon: Laptop, t: "Stolen laptop", d: "OS keychain, session expiry and device revoke." },
  { icon: Server, t: "Compromised server", d: "Only ciphertext in the database and object storage." },
  { icon: PackageCheck, t: "Malicious CLI build", d: "Signed releases and dependency auditing." },
  { icon: Users, t: "Cross-account access", d: "Every query is scoped to the authenticated user." },
];

export default function SecurityPage() {
  return (
    <DocShell
      wide
      eyebrow="Security model"
      title={
        <>
          Security over convenience.
          <br />
          <span className="text-volt-gradient">Always.</span>
        </>
      }
      lead="EnvVault is designed so the server never needs, and never gets, your plaintext."
    >
      <Reveal>
        <div className="glass rounded-3xl p-6 sm:p-8">
          <h2 className="font-semibold">Client-side encryption, end to end</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Envelope: <Code>{'{ formatVersion: 1, algorithm: "AES-256-GCM", keyVersion, nonce, ciphertext, authTag }'}</Code>. The key lives in the
            OS keychain, with a file fallback and a warning.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-5">
            {FLOW.map((s, i) => (
              <div key={s.t} className="relative">
                <div
                  className={`h-full rounded-2xl border p-4 text-center ${
                    i === FLOW.length - 1 ? "border-volt/30 bg-volt/[0.06]" : "border-white/[0.07] bg-black/30"
                  }`}
                >
                  <s.icon className={`mx-auto h-5 w-5 ${i === FLOW.length - 1 ? "text-volt" : "text-zinc-300"}`} />
                  <div className="mt-3 font-mono text-[13px] text-white">{s.t}</div>
                  <div className="mt-1 text-[11px] text-zinc-500">{s.d}</div>
                </div>
                {i < FLOW.length - 1 && (
                  <span className="absolute top-1/2 -right-2.5 z-10 hidden h-px w-2 bg-volt/60 sm:block" aria-hidden />
                )}
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="mt-6 grid items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight">Threat model</h2>
          </Reveal>
          <div className="grid gap-3 sm:grid-cols-2">
            {THREATS.map((x, i) => (
              <Reveal key={x.t} delay={i * 0.06}>
                <div className="glass h-full rounded-2xl p-5">
                  <x.icon className="h-5 w-5 text-volt" />
                  <div className="mt-3 text-sm font-medium">{x.t}</div>
                  <div className="mt-1 text-[13px] leading-6 text-zinc-500">{x.d}</div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div className="rounded-2xl border border-danger/20 bg-danger/[0.04] p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-danger">
                <ShieldOff className="h-4 w-4" /> What we never do
              </div>
              <ul className="mt-3 space-y-2 text-[13px] text-zinc-400">
                <li>Never log <Code>DATABASE_URL</Code> or <Code>JWT_SECRET</Code></li>
                <li>Never print secret values to stdout, telemetry, or shell history</li>
                <li>Never execute project code (<Code>npm install</Code>) during <Code>envvault pull</Code></li>
                <li>Never silently overwrite <Code>.env</Code>. Pull defaults to abort and backs up before restoring.</li>
              </ul>
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <CipherCube size={180} />
        </Reveal>
      </div>
    </DocShell>
  );
}
