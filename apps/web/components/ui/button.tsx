import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "volt";
  size?: "sm" | "md" | "lg";
}

export const buttonVariants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-white text-black hover:bg-zinc-200 shadow-[0_0_24px_-8px_rgba(198,255,74,0.5)]",
  volt: "bg-volt text-black hover:bg-volt-dim",
  secondary: "border border-white/10 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.07] hover:border-white/20",
  ghost: "text-zinc-400 hover:bg-white/[0.05] hover:text-white",
  destructive: "border border-danger/30 bg-danger/[0.06] text-danger hover:bg-danger/[0.12]",
};

export const buttonSizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs rounded-lg",
  md: "h-9 px-4 text-sm rounded-xl",
  lg: "h-11 px-5 text-sm rounded-xl",
};

export const buttonBase =
  "inline-flex items-center justify-center gap-1.5 font-medium transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

export function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  return <button className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`} {...props} />;
}
