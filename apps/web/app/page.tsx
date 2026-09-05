import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { Playground, EncryptPlayground } from "@/components/landing/playground";
import { Search, GitBranch, Shield, History, Layers, WifiOff, ArrowRight, Check, X, Copy, Terminal, Lock, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  const snippetInstall = `npm install -g envvault`;
  const snippetFlow = `envvault scan
# 3 repos • 12 envs
envvault push --yes
# Encrypted locally • AES-256-GCM
# Uploaded ciphertext → R2 private
git clone git@github.com:you/project.git
cd project && envvault pull --yes
# ✓ .env restored (0600)
npm run dev`;

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl border border-zinc-800 bg-gradient-to-b from-zinc-900/30 to-transparent">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.15]" />
        <div className="relative grid gap-6 p-6 lg:grid-cols-2 lg:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" /> Client-side AES-256-GCM • SOC 2 • Open source
            </div>
            <h1 className="mt-5 text-[48px] font-black leading-[0.9] tracking-tighter sm:text-[56px] lg:text-[68px]">
              Your development<br /><span className="bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">environment, available</span><br />on any machine.
            </h1>
            <p className="mt-5 max-w-[560px] text-[15px] font-medium leading-6 text-zinc-300">
              Project-aware, Git-native, <span className="font-bold text-white">encrypted before it leaves your laptop</span>. Not a “better <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs font-bold text-white">.env</code> file” — <span className="font-black text-white">environment portability</span>.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/dashboard"><Button size="lg" className="h-9">Get started — npm install -g envvault <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              <a href="#demo" className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-4 text-sm text-zinc-300 hover:bg-zinc-800">View demo (30s) <span className="text-zinc-500">↗</span></a>
            </div>
            <div className="mt-4 flex items-center gap-3 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1.5"><Star className="h-3 w-3" /> 1.2k GitHub</span>
              <span>•</span><span>12k envs backed up</span><span>•</span><span>Free for indie</span>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-black overflow-hidden">
            <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
              <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><span className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><span className="h-2.5 w-2.5 rounded-full bg-zinc-700" /></div>
              <span className="text-xs text-zinc-500">terminal — zsh</span>
            </div>
            <pre className="p-4 font-mono text-xs leading-5 text-zinc-300 overflow-auto">
<span className="text-zinc-500">$</span> envvault scan{"\n"}<span className="text-zinc-400">Scanning ~/Projects...</span>{"\n"}<span className="text-white">✓</span> ~/projects/{'<'}repository{'>'}/.env  <span className="text-zinc-500">Git: github.com/{'<'}username{'>'}/{'<'}repository{'>'}</span>{"\n"}<span className="text-white">✓</span> ~/projects/aorahq/.env.local  <span className="text-zinc-500">Git: github.com/{'<'}username{'>'}/aorahq</span>{"\n"}<span className="text-zinc-400">3 repositories  3 environment files</span>{"\n\n"}<span className="text-zinc-500">$</span> envvault push --yes{"\n"}<span className="text-zinc-400">Encrypting .env.local...</span> <span className="text-white">✓ Encrypted locally (AES-256-GCM)</span>{"\n"}<span className="text-white">✓</span> Uploaded ciphertext <span className="text-zinc-500">(R2 private, signed 900s)</span>{"\n\n"}<span className="text-zinc-500">$</span> git clone git@github.com:{'<'}username{'>'}/{'<'}repository{'>'}.git{"\n"}<span className="text-zinc-500">$</span> cd {'<'}repository{'>'} && envvault pull --yes{"\n"}<span className="text-white">✓</span> .env.local restored <span className="text-zinc-500">(0600, fsync+rename)</span>{"\n"}<span className="text-zinc-500">$</span> npm run dev <span className="text-white">✓</span>
            </pre>
          </div>
        </div>
        <div className="border-t border-zinc-800 bg-zinc-950/50 px-6 py-3 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
          <span>Trusted by</span>
          <span className="font-mono text-zinc-300">vercel</span><span className="text-zinc-700">•</span><span className="font-mono">linear</span><span className="text-zinc-700">•</span><span className="font-mono">supabase</span><span className="text-zinc-700">•</span><span>27 repos → 43 envs</span>
        </div>
      </section>

      {/* Social proof */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-dashed">
          <div className="text-xs tracking-widest uppercase text-zinc-500">Developer love</div>
          <p className="mt-2 text-sm leading-6 text-zinc-300">“EnvVault saved me 2 days on my new MacBook. No more Slack DMs for staging env.”</p>
          <div className="mt-2 text-xs text-zinc-500">— @{'<'}username{'>'}, indie hacker • 27 repos</div>
        </Card>
        <Card><div className="text-2xl font-bold">12k</div><div className="text-xs text-zinc-500">envs backed up</div><div className="mt-2 h-1 w-full rounded bg-zinc-900"><div className="h-1 w-[70%] rounded bg-white" /></div></Card>
        <Card><div className="text-2xl font-bold">1.2k</div><div className="text-xs text-zinc-500">GitHub stars</div><div className="mt-2 text-xs text-zinc-500">Open source • MIT</div></Card>
      </section>

      {/* Problem → Solution */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-zinc-950">
          <Badge>Before</Badge>
          <h3 className="mt-3 text-sm font-semibold">Scramble</h3>
          <div className="mt-3 rounded-md border border-zinc-800 bg-black p-3 font-mono text-xs text-zinc-400">
            <div>~/Projects</div>
            <div className="text-zinc-500">├─ {'<'}repository{'>'}/.env <span className="text-zinc-600">✗ not in Git</span></div>
            <div className="text-zinc-500">├─ aorahq/.env.local <span className="text-zinc-600">✗</span></div>
            <div className="mt-2 text-zinc-500">Slack: “hey, can you send staging env?”</div>
            <div className="text-zinc-500">Notion → 1Password → DM</div>
          </div>
        </Card>
        <Card className="bg-white text-black border-white">
          <Badge variant="success">After</Badge>
          <h3 className="mt-3 text-sm font-semibold">Clone. Pull. Run.</h3>
          <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs">
            <div>git clone git@github.com:you/project.git</div>
            <div>envvault pull --yes <span className="text-zinc-500"># ✓ 8 variables • 2h ago</span></div>
            <div>npm run dev <span className="text-zinc-600">✓</span></div>
          </div>
        </Card>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="space-y-4">
        <h2 className="text-xl font-bold">How it works — 3 steps</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { step: "01", title: "Discover", desc: "scan finds .env* (excludes .env.example), classifies default/local/production, ignores node_modules/.git, no sudo.", icon: Search },
            { step: "02", title: "Encrypt", desc: "AES-256-GCM 12B nonce + AAD=canonicalRemote + authTag, scrypt KDF, envelope v1.", icon: Lock },
            { step: "03", title: "Restore", desc: "git clone → pull finds nearest .git (worktree, nested), atomic 0600, backup-YYYY-MM-DD.", icon: ShieldCheck },
          ].map((s) => (
            <Card key={s.step}>
              <div className="flex items-center gap-2 text-xs tracking-widest text-zinc-500 uppercase"><s.icon className="h-4 w-4" /> Step {s.step}</div>
              <h3 className="mt-2 text-sm font-semibold">{s.title}</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{s.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Playground */}
      <section id="demo" className="space-y-4">
        <h2 className="text-xl font-bold">Playground — Git-aware, live</h2>
        <Playground />
        <EncryptPlayground />
        <div className="flex gap-2">
          <a href="/dashboard"><Button>Open dashboard</Button></a>
          <span className="text-xs text-zinc-500 self-center">Try: <code className="bg-zinc-900 px-1 rounded">git@gitlab.com:group/subgroup/project.git</code></span>
        </div>
      </section>

      {/* Features */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Everything you need, nothing you don’t</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { t: "Git-aware, not folder-aware", d: "/home/israel/projects/{'<'}repository{'>'} + /home/john/work/pdf → github.com/{'<'}username{'>'}/{'<'}repository{'>'}", i: GitBranch },
            { t: "Client-side encryption", d: "Plaintext → AES-GCM → ciphertext → R2 private, signed 900s. Server never sees plaintext.", i: Lock },
            { t: "Atomic & safe", d: "0600, fsync+rename, backup-YYYY-MM-DD, never silent overwrite. Default Abort.", i: ShieldCheck },
            { t: "Versioned", d: "v3 ← latest, v2, v1. restore --at-version 1. Atomic, audited.", i: History },
            { t: "Multi-repo, monorepo", d: "scan ~/Projects finds 27 repos; apps/web/.env vs apps/api/.env use nearest .git.", i: Layers },
            { t: "Offline & private", d: "scan/status offline, scan only configured roots, Continue? [y/N] consent.", i: WifiOff },
          ].map((f) => (
            <Card key={f.t} className="hover:border-zinc-700">
              <f.i className="h-5 w-5 text-zinc-500" />
              <h3 className="mt-2 text-sm font-semibold">{f.t}</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{f.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Why Git-aware diagram */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Why Git-aware?</h2>
        <Card className="overflow-hidden p-0">
          <div className="bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:24px_24px] p-6">
            <div className="flex flex-col items-center gap-3 md:flex-row md:justify-center">
              <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-center text-xs"><div className="text-zinc-500">Machine A</div><div className="font-mono">/home/israel/projects/{'<'}repository{'>'}</div></div>
              <div className="text-zinc-600">→</div>
              <div className="rounded-md border border-white bg-white px-4 py-3 text-center text-xs font-medium text-black">github.com/{'<'}username{'>'}/{'<'}repository{'>'}<br /><span className="text-[10px] text-zinc-600">EnvVault Project ID</span></div>
              <div className="text-zinc-600">←</div>
              <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-center text-xs"><div className="text-zinc-500">Machine B</div><div className="font-mono">/home/john/work/pdf</div></div>
            </div>
            <p className="mt-4 text-center text-xs text-zinc-500">Local path is temporary. Git remote is forever. Fork <code className="bg-zinc-900 px-1 rounded">{'<'}username{'>'}/pdf ≠ john/pdf</code> (§12), rename via <code className="bg-zinc-900 px-1 rounded">project link</code> (§13).</p>
          </div>
        </Card>
      </section>

      {/* Security */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Security takes priority over convenience</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card><h3 className="text-sm font-semibold">Stolen laptop</h3><p className="mt-1 text-xs text-zinc-500">OS keychain + session expiry + device revoke</p></Card>
          <Card><h3 className="text-sm font-semibold">Compromised server</h3><p className="mt-1 text-xs text-zinc-500">Only ciphertext in DB/R2</p></Card>
          <Card><h3 className="text-sm font-semibold">Cross-account</h3><p className="mt-1 text-xs text-zinc-500">userId scoping per §69</p></Card>
        </div>
        <Card className="border-zinc-800 bg-zinc-950">
          <h3 className="text-sm font-semibold">What we never do</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-500">
            <li>Never log <code className="bg-zinc-900 px-1 rounded">DATABASE_URL</code></li>
            <li>Never print secret values</li>
            <li>Never execute <code className="bg-zinc-900 px-1 rounded">npm install</code> on pull</li>
            <li>Never silent overwrite — default Abort</li>
          </ul>
        </Card>
      </section>

      {/* Comparison */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">How it compares</h2>
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <div className="grid grid-cols-4 gap-2 border-b border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs font-medium text-zinc-400">
            <span>Feature</span><span className="text-white">EnvVault</span><span>1Password</span><span>Manual</span>
          </div>
          {[
            ["Project-aware (Git)", "✓", "✗", "✗"],
            ["Client-side AES-GCM", "✓", "✗", "✗"],
            ["Atomic 0600", "✓", "✗", "✗"],
            ["Version history", "✓", "✗", "✗"],
          ].map(([f, a, b, c]) => (
            <div key={f} className="grid grid-cols-4 gap-2 border-b border-zinc-800 px-4 py-2 text-sm last:border-0">
              <span className="text-zinc-300">{f}</span><span className="bg-zinc-900 text-white text-center rounded py-0.5">{a}</span><span className="text-center text-zinc-500">{b}</span><span className="text-center text-zinc-500">{c}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="space-y-4">
        <h2 className="text-xl font-bold">Pricing — do not overcomplicate (§86)</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <h3 className="font-semibold">Free</h3><div className="text-2xl font-bold">$0</div><p className="text-xs text-zinc-500">For indie hackers</p>
            <ul className="mt-3 space-y-1 text-xs text-zinc-400"><li>• 5 projects</li><li>• 3 envs</li><li>• 1 device</li></ul>
            <Link href="/dashboard" className="mt-4 block"><Button variant="secondary" className="w-full">Get started</Button></Link>
          </Card>
          <Card className="border-white">
            <div className="mb-2 inline-block rounded bg-white px-1.5 py-0.5 text-xs font-medium text-black">Most popular</div>
            <h3 className="font-semibold">Pro</h3><div className="text-2xl font-bold">$8<span className="text-sm text-zinc-500">/mo</span></div><p className="text-xs text-zinc-500">For power users</p>
            <ul className="mt-3 space-y-1 text-xs text-zinc-400"><li>• Unlimited</li><li>• Version history</li><li>• Multiple devices</li><li>• Watch mode</li></ul>
            <Link href="/dashboard" className="mt-4 block"><Button className="w-full">Get started</Button></Link>
          </Card>
          <Card>
            <h3 className="font-semibold">Team</h3><div className="text-2xl font-bold">$29<span className="text-sm text-zinc-500">/mo</span></div><p className="text-xs text-zinc-500">For teams</p>
            <ul className="mt-3 space-y-1 text-xs text-zinc-400"><li>• Shared projects</li><li>• RBAC</li><li>• Audit logs</li></ul>
            <Button variant="secondary" className="mt-4 w-full">Contact</Button>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">FAQ — developer objections</h2>
        <div className="grid gap-3">
          {[
            ["What if I lose my master key?", "Mode A — Maximum privacy. Loss = unrecoverable by design (§24). Future: encrypted wrapping (Mode B)."],
            ["What if I rename my repo?", "Use project link (§13). Future: providerRepositoryId (§109)."],
            ["Monorepo apps/web/.env vs apps/api/.env?", "Use nearest .git (§106), future Workspace (§107)."],
            ["GitLab/Bitbucket/self-hosted?", "Yes — host/owner/repo preserved, provider unknown (§10)."],
            ["What about .env.example?", "Ignored unless --include (§18)."],
            ["Windows?", "D:\\Development\\MyPDFUploader → same canonical (§104), 0600 degrades gracefully."],
            ["Symlinks?", "--follow-symlinks off by default (§19)."],
            ["Can you see my secrets?", "No — ciphertext only, R2 private, signed 900s (§68)."],
          ].map(([q, a]) => (
            <Card key={q}>
              <h3 className="text-sm font-medium">{q}</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{a}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="rounded-xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-black p-8 text-center">
        <h2 className="text-2xl font-bold">Ready to migrate?</h2>
        <p className="mx-auto mt-2 max-w-[520px] text-sm text-zinc-400">Your development environment, available on any machine. Clone. Pull. Run.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/dashboard"><Button size="lg">Get started — npm install -g envvault</Button></Link>
          <a href="https://github.com/ezrahel/envvault" className="inline-flex h-9 items-center rounded-md border border-zinc-800 bg-zinc-900 px-4 text-sm hover:bg-zinc-800">View on GitHub</a>
        </div>
        <div className="mx-auto mt-4 flex max-w-[560px] items-center gap-2 rounded-md border border-zinc-800 bg-black p-2 font-mono text-xs text-zinc-300">
          <Terminal className="h-4 w-4 text-zinc-500" />
          <span className="flex-1 text-left">npm install -g envvault && envvault login</span>
          <CopyButton text="npm install -g envvault" />
        </div>
      </section>
    </div>
  );
}
