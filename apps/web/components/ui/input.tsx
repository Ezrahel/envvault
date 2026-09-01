import * as React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`flex h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 ${className}`}
      {...props}
    />
  ),
);
Input.displayName = "Input";
