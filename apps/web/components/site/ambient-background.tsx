/** Fixed, non-interactive backdrop for app pages: aurora glows + masked grid + slow spiral. */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="bg-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_20%,transparent_70%)]" />
      <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-iris/20 blur-[120px]" />
      <div className="absolute -top-24 left-[62%] h-[300px] w-[420px] rounded-full bg-volt/10 blur-[100px]" />
      <svg className="animate-spin-slow absolute -top-[360px] left-1/2 h-[900px] w-[900px] -translate-x-1/2 opacity-[0.07]" viewBox="-100 -100 200 200">
        {Array.from({ length: 4 }).map((_, arm) => (
          <path
            key={arm}
            fill="none"
            stroke="white"
            strokeWidth="0.35"
            transform={`rotate(${arm * 90})`}
            d={Array.from({ length: 120 }, (_, i) => {
              const t = i / 119;
              const a = t * Math.PI * 3.2;
              const r = 4 + t * 92;
              return `${i ? "L" : "M"}${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
            }).join(" ")}
          />
        ))}
      </svg>
    </div>
  );
}
