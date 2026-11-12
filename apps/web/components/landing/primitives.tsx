"use client";
import { useRef } from "react";
import { motion, useInView } from "motion/react";

const ease = [0.16, 1, 0.3, 1] as const;

/** Fade/slide children in when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.9, ease, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  align?: "center" | "left";
}) {
  return (
    <Reveal className={align === "center" ? "mx-auto max-w-[760px] text-center" : "max-w-[640px]"}>
      <div className={`inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-volt uppercase ${align === "center" ? "" : ""}`}>
        <span className="h-px w-6 bg-volt/60" />
        {eyebrow}
        {align === "center" && <span className="h-px w-6 bg-volt/60" />}
      </div>
      <h2 className="text-gradient mt-4 text-[34px] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-[52px]">{title}</h2>
      {sub && <p className="mt-4 text-[15px] leading-7 text-zinc-400 sm:text-base">{sub}</p>}
    </Reveal>
  );
}

/** Infinite horizontal marquee. Children are rendered twice for a seamless loop. */
export function Marquee({ children, duration = 40, className = "" }: { children: React.ReactNode; duration?: number; className?: string }) {
  return (
    <div className={`mask-fade-x group flex overflow-hidden ${className}`}>
      <div
        className="animate-marquee flex w-max shrink-0 items-center group-hover:[animation-play-state:paused]"
        style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Card with a cursor-following glow and optional 3D tilt. */
export function SpotlightCard({
  children,
  className = "",
  tilt = false,
}: {
  children: React.ReactNode;
  className?: string;
  tilt?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    el.style.setProperty("--mx", `${x}px`);
    el.style.setProperty("--my", `${y}px`);
    if (tilt) {
      const rx = ((y / r.height) - 0.5) * -6;
      const ry = ((x / r.width) - 0.5) * 8;
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    }
  };
  const onLeave = () => {
    if (tilt && ref.current) ref.current.style.transform = "";
  };
  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`spotlight glass rounded-3xl transition-[transform,border-color] duration-300 ease-out hover:border-white/15 ${className}`}
    >
      {children}
    </div>
  );
}
