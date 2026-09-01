import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

export function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600 disabled:opacity-50";
  const variants: Record<string, string> = {
    primary: "bg-white text-black hover:bg-zinc-200",
    secondary: "border border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:border-zinc-700",
    ghost: "text-zinc-400 hover:bg-zinc-900 hover:text-white",
    destructive: "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700",
  };
  const sizes: Record<string, string> = {
    sm: "h-7 px-3 text-xs",
    md: "h-8 px-4 text-sm",
    lg: "h-9 px-5 text-sm",
  };
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}
