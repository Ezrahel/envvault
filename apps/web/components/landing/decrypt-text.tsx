"use client";
import { useEffect, useRef, useState } from "react";

const GLYPHS = "ABCDEF0123456789abcdef+/=#$%&@";

/**
 * Text that "decrypts" — characters scramble through cipher glyphs and
 * resolve left-to-right. Starts when scrolled into view (or on mount).
 */
export function DecryptText({
  text,
  className = "",
  delay = 0,
  speed = 28,
  trigger = "view",
}: {
  text: string;
  className?: string;
  delay?: number;
  speed?: number;
  trigger?: "view" | "mount" | "hover";
}) {
  const [out, setOut] = useState(text);
  const ref = useRef<HTMLSpanElement>(null);
  const running = useRef(false);

  const run = () => {
    if (running.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setOut(text);
    running.current = true;
    let frame = 0;
    const total = text.length;
    const id = window.setInterval(() => {
      frame++;
      const resolved = Math.floor(frame / 2);
      setOut(
        text
          .split("")
          .map((ch, i) => (ch === " " || i < resolved ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
          .join(""),
      );
      if (resolved >= total) {
        window.clearInterval(id);
        setOut(text);
        running.current = false;
      }
    }, speed);
  };

  useEffect(() => {
    // Pre-scramble so SSR text doesn't flash resolved → scrambled.
    if (trigger === "hover") return;
    const el = ref.current;
    if (!el) return;
    let t: number | undefined;
    if (trigger === "mount") {
      t = window.setTimeout(run, delay);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) {
        t = window.setTimeout(run, delay);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <span
      ref={ref}
      className={className}
      onMouseEnter={trigger === "hover" ? run : undefined}
      aria-label={text}
    >
      <span aria-hidden>{out}</span>
    </span>
  );
}
