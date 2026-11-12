import * as React from "react";

type Variant = "default" | "success" | "volt" | "iris" | "danger";

export function Badge({ className = "", variant = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  const base = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider uppercase";
  const variants: Record<Variant, string> = {
    default: "border-white/10 bg-white/[0.04] text-zinc-400",
    success: "border-volt/30 bg-volt/10 text-volt",
    volt: "border-volt/30 bg-volt/10 text-volt",
    iris: "border-iris/30 bg-iris/10 text-iris",
    danger: "border-danger/30 bg-danger/10 text-danger",
  };
  return <span className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
