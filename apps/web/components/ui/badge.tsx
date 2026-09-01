import * as React from "react";

export function Badge({ className = "", variant = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "success" }) {
  const base = "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium tracking-widest uppercase";
  const variants = {
    default: "border-zinc-700 bg-zinc-900 text-zinc-400",
    success: "border-zinc-700 bg-white text-black",
  };
  return <span className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
