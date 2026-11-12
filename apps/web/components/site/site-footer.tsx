import { LogoMark } from "./logo";

const COLS = [
  {
    title: "Product",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#playground", label: "Playground" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/security", label: "Security model" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "https://github.com/ezrahel/envvault", label: "GitHub" },
      { href: "https://github.com/ezrahel/envvault/tree/master/docs/cli", label: "CLI reference" },
      { href: "https://github.com/ezrahel/envvault/tree/master/docs/api", label: "API" },
    ],
  },
];

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <footer className="mt-16 border-t border-white/[0.06] py-6">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 text-xs text-zinc-500 sm:px-6">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-volt shadow-[0_0_10px_var(--color-volt)]" />
            Secrets are encrypted client-side. The server stores ciphertext only.
          </span>
          <span className="flex gap-4">
            <a href="/security" className="hover:text-zinc-200">Security</a>
            <a href="/privacy" className="hover:text-zinc-200">Privacy</a>
            <a href="/terms" className="hover:text-zinc-200">Terms</a>
          </span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="relative mt-24 overflow-hidden border-t border-white/[0.06]">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-semibold">EnvVault</span>
          </div>
          <p className="mt-4 max-w-[280px] text-sm leading-6 text-zinc-500">
            Your development environment, available on any machine. Encrypted before it leaves your laptop.
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <div className="text-xs font-medium tracking-widest text-zinc-500 uppercase">{c.title}</div>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-zinc-300 transition-colors hover:text-volt">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {/* Oversized wordmark — fades into the page edge */}
      <div
        aria-hidden
        className="pointer-events-none select-none px-4 text-center text-[22vw] leading-[0.8] font-black tracking-tighter text-transparent sm:text-[18vw]"
        style={{ WebkitTextStroke: "1px rgba(255,255,255,0.07)", maskImage: "linear-gradient(to bottom, #000 30%, transparent)" }}
      >
        envvault
      </div>
      <div className="border-t border-white/[0.06] py-5 text-center text-xs text-zinc-600">
        Open source · AES-256-GCM · Ciphertext only on the server
      </div>
    </footer>
  );
}
