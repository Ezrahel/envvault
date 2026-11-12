"use client";
import { useEffect, useRef } from "react";

/* ── CSS 3D cube: each face is one security primitive ───────────── */
const FACES = [
  { label: "AES-256", sub: "GCM", t: "rotateY(0deg)" },
  { label: "AAD", sub: "canonical remote", t: "rotateY(90deg)" },
  { label: "scrypt", sub: "key derivation", t: "rotateY(180deg)" },
  { label: "0600", sub: "atomic restore", t: "rotateY(-90deg)" },
  { label: "12 B", sub: "nonce", t: "rotateX(90deg)" },
  { label: "16 B", sub: "auth tag", t: "rotateX(-90deg)" },
];

export function CipherCube({ size = 200 }: { size?: number }) {
  const half = size / 2;
  return (
    <div className="relative grid place-items-center" style={{ perspective: 900, height: size * 1.8 }}>
      <div aria-hidden className="absolute h-[70%] w-[70%] rounded-full bg-volt/15 blur-[80px]" />
      <div className="cube relative" style={{ width: size, height: size, transformStyle: "preserve-3d" }}>
        {FACES.map((f) => (
          <div
            key={f.label}
            className="absolute inset-0 grid place-items-center rounded-2xl border border-volt/30 bg-[linear-gradient(140deg,rgba(198,255,74,0.12),rgba(139,124,255,0.08)_60%,rgba(5,5,7,0.6))] backdrop-blur-sm"
            style={{ transform: `${f.t} translateZ(${half}px)`, backfaceVisibility: "hidden" }}
          >
            <div className="bg-dots absolute inset-0 rounded-2xl opacity-50" />
            <div className="relative text-center">
              <div className="font-mono text-3xl font-semibold text-white">{f.label}</div>
              <div className="mt-1 font-mono text-[11px] tracking-wider text-volt uppercase">{f.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .cube { animation: cube-spin 16s cubic-bezier(.65,0,.35,1) infinite; }
        @keyframes cube-spin {
          0%   { transform: rotateX(-18deg) rotateY(0deg); }
          16%  { transform: rotateX(-18deg) rotateY(-90deg); }
          33%  { transform: rotateX(-18deg) rotateY(-180deg); }
          50%  { transform: rotateX(-18deg) rotateY(-270deg); }
          66%  { transform: rotateX(-100deg) rotateY(-360deg); }
          83%  { transform: rotateX(80deg) rotateY(-360deg); }
          100% { transform: rotateX(-18deg) rotateY(-360deg); }
        }
      `}</style>
    </div>
  );
}

/* ── Golden-angle spiral (2D canvas) ────────────────────────────── */
export function SpiralField({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));
    const N = 900;
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.hypot(w, h) * 0.55;
      const rot = t * 0.00005;
      for (let i = 0; i < N; i++) {
        const k = i / N;
        const r = Math.sqrt(k) * maxR;
        // Inner points rotate faster → visible spiral arms.
        const a = i * GOLDEN + rot * (1.4 - k) * 40;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r * 0.62;
        const wave = 0.5 + 0.5 * Math.sin(k * 18 - t * 0.0016);
        const size = 0.6 + wave * 1.8 * (1 - k * 0.5);
        const alpha = (1 - k) * 0.85 * (0.35 + wave * 0.65);
        ctx.fillStyle = i % 5 === 0 ? `rgba(139,124,255,${alpha})` : `rgba(198,255,74,${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (visible && !document.hidden) draw(t);
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(4000);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(canvas);
    if (reduced) draw(4000);
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={`h-full w-full ${className}`} />;
}
