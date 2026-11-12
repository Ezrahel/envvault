"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Apple, Monitor, Terminal as TermIcon, Vault } from "lucide-react";
import { LogoMark } from "@/components/site/logo";

type P = { d: string; key: string; delay: number };

const MACHINES = [
  { os: "macOS", path: "~/Projects/web", icon: Apple },
  { os: "Windows", path: "D:\\Work\\web-old", icon: Monitor },
  { os: "Linux", path: "/home/ci/build/web", icon: TermIcon },
];

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function GitBeams() {
  const wrap = useRef<HTMLDivElement>(null);
  const sources = useRef<(HTMLDivElement | null)[]>([]);
  const hub = useRef<HTMLDivElement>(null);
  const vault = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<P[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useIsoLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const compute = () => {
      const base = el.getBoundingClientRect();
      const center = (n: Element) => {
        const r = n.getBoundingClientRect();
        return { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2, w: r.width, h: r.height };
      };
      const curve = (a: ReturnType<typeof center>, b: ReturnType<typeof center>) => {
        const horizontal = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
        if (horizontal) {
          const x1 = a.x + a.w / 2;
          const x2 = b.x - b.w / 2;
          const mx = (x1 + x2) / 2;
          return `M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`;
        }
        const y1 = a.y + a.h / 2;
        const y2 = b.y - b.h / 2;
        const my = (y1 + y2) / 2;
        return `M${a.x},${y1} C${a.x},${my} ${b.x},${my} ${b.x},${y2}`;
      };
      if (!hub.current || !vault.current) return;
      const h = center(hub.current);
      const v = center(vault.current);
      const next: P[] = sources.current
        .filter(Boolean)
        .map((s, i) => ({ d: curve(center(s!), h), key: `s${i}`, delay: i * 0.7 }));
      next.push({ d: curve(h, v), key: "hv", delay: 0.35 });
      setPaths(next);
      setSize({ w: base.width, h: base.height });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrap} className="relative">
      <svg className="pointer-events-none absolute inset-0 overflow-visible" width={size.w} height={size.h} aria-hidden>
        <defs>
          <filter id="beam-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {paths.map((p) => (
          <g key={p.key}>
            <path d={p.d} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={1.5} />
            <path
              d={p.d}
              fill="none"
              stroke={p.key === "hv" ? "var(--color-iris)" : "var(--color-volt)"}
              strokeWidth={2}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="14 86"
              filter="url(#beam-glow)"
              style={{ animation: `beam 2.8s linear ${p.delay}s infinite` }}
            />
          </g>
        ))}
      </svg>
      <style>{`@keyframes beam { from { stroke-dashoffset: 100 } to { stroke-dashoffset: 0 } }`}</style>

      <div className="relative grid items-center gap-14 md:grid-cols-[1fr_auto_auto] md:gap-16 lg:gap-24">
        <div className="grid gap-4">
          {MACHINES.map((m, i) => (
            <div
              key={m.os}
              ref={(n) => {
                sources.current[i] = n;
              }}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-ink-850 px-4 py-3 transition-colors hover:border-white/20"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
                <m.icon className="h-4 w-4 text-zinc-300" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] text-zinc-500">{m.os}</div>
                <div className="truncate font-mono text-[13px] text-zinc-200">{m.path}</div>
              </div>
            </div>
          ))}
        </div>

        <div ref={hub} className="relative mx-auto">
          <span className="animate-pulse-ring absolute inset-0 rounded-3xl border border-volt/40" />
          <div className="ring-gradient relative rounded-3xl bg-ink-850 px-6 py-5 text-center">
            <LogoMark className="mx-auto h-10 w-10" />
            <div className="mt-3 font-mono text-[13px] font-semibold whitespace-nowrap text-white">github.com/acme/web</div>
            <div className="mt-1 text-[11px] text-zinc-500">one canonical project ID</div>
          </div>
        </div>

        <div ref={vault} className="mx-auto rounded-2xl border border-white/[0.08] bg-ink-850 px-5 py-4 text-center">
          <Vault className="mx-auto h-6 w-6 text-iris" />
          <div className="mt-2 text-[13px] font-medium whitespace-nowrap">Encrypted vault</div>
          <div className="font-mono text-[11px] whitespace-nowrap text-zinc-500">v1 · v2 · v3</div>
        </div>
      </div>
    </div>
  );
}
