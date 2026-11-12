import * as React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`flex h-9 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-1 text-sm text-white placeholder:text-zinc-500 transition-colors focus:border-volt/50 focus:outline-none ${className}`}
      {...props}
    />
  ),
);
Input.displayName = "Input";
