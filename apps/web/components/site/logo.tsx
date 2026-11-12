/** EnvVault mark: a vault aperture — three spiral blades around a core. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="ev-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c6ff4a" />
          <stop offset="1" stopColor="#8b7cff" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#0e0e14" stroke="rgba(255,255,255,0.12)" />
      <g className="origin-center transition-transform duration-700 group-hover:rotate-[120deg]" style={{ transformBox: "fill-box" }}>
        {[0, 120, 240].map((r) => (
          <path
            key={r}
            d="M16 16 C 16 10, 20 7.5, 24 8.5 C 21.5 10.5, 20 13, 16 16 Z"
            fill="url(#ev-g)"
            transform={`rotate(${r} 16 16)`}
            opacity={r === 0 ? 1 : 0.75}
          />
        ))}
      </g>
      <circle cx="16" cy="16" r="2.4" fill="#fff" />
    </svg>
  );
}

export function Logo({ badge = true }: { badge?: boolean }) {
  return (
    <a href="/" className="group flex items-center gap-2.5" aria-label="EnvVault home">
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">EnvVault</span>
      {badge && (
        <span className="hidden rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-zinc-400 sm:inline">
          v0.1
        </span>
      )}
    </a>
  );
}
