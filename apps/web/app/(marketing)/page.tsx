import Link from "next/link";
import { ArrowRight, Check, KeyRound, Laptop, Server, ShieldOff, Users } from "lucide-react";
import { Hero } from "@/components/landing/hero";
import { Pipeline } from "@/components/landing/pipeline";
import { CipherPlayground } from "@/components/landing/cipher-playground";
import { GitBeams } from "@/components/landing/git-beams";
import { Bento } from "@/components/landing/bento";
import { CipherCube, SpiralField } from "@/components/landing/visuals";
import { Comparison, Faq, Pricing } from "@/components/landing/sections";
import { Marquee, Reveal, SectionHeading } from "@/components/landing/primitives";
import { DecryptText } from "@/components/landing/decrypt-text";
import { CopyButton } from "@/components/copy-button";

const WORKS_WITH = [
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "self-hosted Git",
  "GitLab subgroups",
  "macOS",
  "Linux",
  "Windows",
  "monorepos",
  "git worktrees",
  ".env · .env.local · .env.production",
];

const SCRAMBLE = [
  { who: "you", msg: "hey can you send me the staging .env?", x: "left-[4%]", y: "top-[8%]", r: "-rotate-3" },
  { who: "sam", msg: "which one lol, I have 3", x: "right-[6%]", y: "top-[30%]", r: "rotate-2" },
  { who: "you", msg: "the one that works 🙏", x: "left-[10%]", y: "top-[52%]", r: "rotate-1" },
  { who: "sam", msg: "check notion? or 1password? idk", x: "right-[3%]", y: "top-[72%]", r: "-rotate-2" },
];

export default function LandingPage() {
  return (
    <div className="relative">
      <Hero />

      {/* Works with */}
      <section className="border-y border-white/[0.05] bg-white/[0.01] py-6">
        <Marquee duration={45}>
          {WORKS_WITH.map((w) => (
            <span key={w} className="mx-6 inline-flex items-center gap-3 font-mono text-[13px] whitespace-nowrap text-zinc-500">
              <span className="h-1 w-1 rounded-full bg-volt/70" />
              {w}
            </span>
          ))}
        </Marquee>
      </section>

      {/* Problem → Solution */}
      <section className="mx-auto max-w-[1200px] px-4 pt-28 sm:px-6">
        <SectionHeading
          eyebrow="The problem"
          title={
            <>
              .env files are the one thing
              <br className="hidden sm:block" /> Git refuses to carry.
            </>
          }
          sub="You keep them out of the repo for good reason. Then you get a new laptop and spend two days collecting them from DMs."
        />
        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          <Reveal>
            <div className="glass relative h-[340px] overflow-hidden rounded-3xl p-6">
              <div className="font-mono text-[11px] tracking-widest text-zinc-500 uppercase">Before</div>
              <div className="mt-1 text-lg font-semibold">The scramble</div>
              <div className="absolute inset-x-0 top-20 bottom-0">
                {SCRAMBLE.map((s, i) => (
                  <div
                    key={i}
                    className={`animate-float absolute max-w-[78%] ${s.x} ${s.y} ${s.r} rounded-2xl border border-white/10 bg-ink-800/90 px-4 py-2.5 text-[13px] shadow-xl`}
                    style={{ animationDelay: `${i * 0.7}s` }}
                  >
                    <span className="mr-2 font-mono text-[11px] text-zinc-500">@{s.who}</span>
                    <span className="text-zinc-300">{s.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="ring-gradient relative h-[340px] overflow-hidden rounded-3xl bg-ink-850 p-6">
              <div aria-hidden className="absolute -right-20 -bottom-24 h-72 w-72 rounded-full bg-volt/15 blur-[90px]" />
              <div className="font-mono text-[11px] tracking-widest text-volt uppercase">After</div>
              <div className="mt-1 text-lg font-semibold">
                <DecryptText text="Clone. Pull. Run." />
              </div>
              <div className="relative mt-8 space-y-3 font-mono text-[13px]">
                {[
                  ["$ git clone git@github.com:acme/web.git", "text-white"],
                  ["$ envvault pull --yes", "text-white"],
                  ["✓ .env.local restored · 6 variables · v3", "text-volt"],
                  ["$ npm run dev", "text-white"],
                  ["▲ ready in 1.2s", "text-zinc-400"],
                ].map(([l, c]) => (
                  <div key={l} className={`${c} break-words`}>
                    {l}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <Pipeline />

      {/* Playground */}
      <section id="playground" className="mx-auto max-w-[1200px] px-4 pt-28 sm:px-6">
        <SectionHeading
          eyebrow="Playground"
          title={
            <>
              Don&apos;t trust us.
              <br />
              Watch the bytes.
            </>
          }
          sub={
            <>
              This is real AES-256-GCM running in your browser via WebCrypto. Edit the file, change the remote, then try to break it.
              <span className="mt-1 block text-xs text-zinc-600">The demo derives keys with PBKDF2; the CLI uses scrypt. Nothing typed here leaves the page.</span>
            </>
          }
        />
        <Reveal className="mt-14">
          <CipherPlayground />
        </Reveal>
      </section>

      {/* Git-aware */}
      <section className="mx-auto max-w-[1200px] px-4 pt-32 sm:px-6">
        <div className="grid gap-16">
          <SectionHeading
            eyebrow="Git-aware identity"
            title={
              <>
                Folders are temporary.
                <br />
                Remotes are forever.
              </>
            }
            sub={
              <>
                The same repo cloned to three different paths on three operating systems is still one project. EnvVault keys everything on the
                canonical remote, so <span className="text-zinc-200">a fork can never open your secrets</span>.
              </>
            }
          />
          <Reveal delay={0.1} className="mx-auto w-full max-w-[1000px]">
            <GitBeams />
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-[1200px] px-4 pt-32 sm:px-6">
        <SectionHeading eyebrow="Features" title="Small surface. Sharp edges filed off." sub="Everything a migration needs and nothing that would make you nervous about it." />
        <div className="mt-14">
          <Bento />
        </div>
      </section>

      {/* Security */}
      <section className="relative mx-auto max-w-[1200px] px-4 pt-32 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Security"
              title={
                <>
                  Security over
                  <br />
                  convenience. Always.
                </>
              }
              sub="EnvVault is built so that a full server compromise leaks nothing you'd have to rotate."
            />
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {[
                { i: Laptop, t: "Stolen laptop", d: "OS keychain, session expiry, one-click device revoke." },
                { i: Server, t: "Compromised server", d: "Only ciphertext in the database and object storage." },
                { i: Users, t: "Cross-account access", d: "Every query is scoped to the authenticated user." },
                { i: KeyRound, t: "Key custody", d: "Your key never leaves your machine. Auth ≠ encryption." },
              ].map((x, i) => (
                <Reveal key={x.t} delay={i * 0.06}>
                  <div className="glass h-full rounded-2xl p-4">
                    <x.i className="h-4 w-4 text-volt" />
                    <div className="mt-3 text-sm font-medium">{x.t}</div>
                    <div className="mt-1 text-[13px] leading-6 text-zinc-500">{x.d}</div>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-4">
              <div className="rounded-2xl border border-danger/20 bg-danger/[0.04] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-danger">
                  <ShieldOff className="h-4 w-4" /> What we never do
                </div>
                <ul className="mt-3 grid gap-2 text-[13px] text-zinc-400 sm:grid-cols-2">
                  {["Log secret values or DATABASE_URL", "Print secrets to stdout or history", "Run project code on pull", "Overwrite a file without asking"].map((s) => (
                    <li key={s} className="flex items-start gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-danger" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.15}>
            <CipherCube />
            <div className="text-center">
              <Link href="/security" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-volt">
                Read the full security model <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-[1000px] px-4 pt-32 sm:px-6">
        <SectionHeading eyebrow="Comparison" title="Built for one job." sub="Password managers store secrets. EnvVault moves your environment." />
        <div className="mt-12">
          <Comparison />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-[1200px] px-4 pt-32 sm:px-6">
        <SectionHeading eyebrow="Pricing" title="Simple. Like the CLI." sub="Start free. Upgrade when you have more machines than fingers." />
        <div className="mt-14">
          <Pricing />
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[1200px] px-4 pt-32 sm:px-6">
        <SectionHeading eyebrow="FAQ" title="Questions developers ask first." />
        <div className="mt-12">
          <Faq />
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pt-32 sm:px-6">
        <Reveal>
          <div className="ring-gradient relative mx-auto max-w-[1200px] overflow-hidden rounded-[2rem] bg-ink-900">
            <div className="absolute inset-0 opacity-90">
              <SpiralField />
            </div>
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_50%_55%_at_50%_50%,rgba(5,5,7,0.88),transparent)]" />
            <div className="relative px-6 py-24 text-center sm:py-32">
              <h2 className="text-gradient mx-auto max-w-[760px] text-[40px] leading-[0.98] font-semibold tracking-[-0.04em] sm:text-[68px]">
                Your next laptop is
                <br />
                <span className="text-volt-gradient">one command away.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-[480px] text-zinc-400">Back up every repo&apos;s environment in under a minute. Restore it anywhere.</p>
              <div className="mx-auto mt-9 flex max-w-[460px] items-center gap-3 rounded-2xl border border-white/10 bg-black/60 p-2 pl-4 font-mono text-[13px] backdrop-blur">
                <span className="text-volt">$</span>
                <span className="flex-1 truncate text-left text-zinc-200">npm i -g envvault && envvault backup</span>
                <CopyButton text="npm install -g envvault && envvault backup" />
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-zinc-500">
                {["Free for indie projects", "Open source", "No credit card"].map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-volt" /> {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
