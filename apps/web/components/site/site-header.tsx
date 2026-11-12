"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Logo } from "./logo";
import { CommandPalette } from "@/components/command-palette";

const MARKETING_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#playground", label: "Playground" },
  { href: "/security", label: "Security" },
  { href: "/#pricing", label: "Pricing" },
];

const APP_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/projects", label: "Projects" },
  { href: "/environments", label: "Environments" },
  { href: "/versions", label: "Versions" },
  { href: "/devices", label: "Devices" },
];

export function SiteHeader({ variant }: { variant: "marketing" | "app" }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const links = variant === "app" ? APP_LINKS : MARKETING_LINKS;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    variant === "app" ? pathname === href || (href !== "/dashboard" && pathname.startsWith(href)) : pathname === href;

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-4">
      <div
        className={`mx-auto flex h-14 max-w-[1200px] items-center justify-between rounded-2xl px-3 transition-all duration-500 sm:px-4 ${
          scrolled || variant === "app" || open
            ? "glass !bg-[rgba(9,9,13,0.82)] shadow-[0_10px_40px_-12px_rgba(0,0,0,0.7)]"
            : "border border-transparent"
        }`}
      >
        <Logo />

        <nav className="hidden items-center gap-1 text-[13px] md:flex">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative rounded-lg px-3 py-1.5 transition-colors ${active ? "text-white" : "text-zinc-400 hover:text-white"}`}
              >
                {active && (
                  <motion.span
                    layoutId={`nav-pill-${variant}`}
                    className="absolute inset-0 -z-10 rounded-lg border border-white/10 bg-white/[0.06]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {variant === "app" ? (
            <>
              <CommandPalette />
              <Link
                href="/account"
                className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-medium transition-colors ${
                  pathname === "/account" ? "border-volt/60 bg-volt/10 text-volt" : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/20"
                }`}
                aria-label="Account"
              >
                A
              </Link>
            </>
          ) : (
            <>
              <a
                href="https://github.com/ezrahel/envvault"
                className="hidden items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] text-zinc-400 transition-colors hover:text-white sm:inline-flex"
              >
                GitHub <ArrowUpRight className="h-3 w-3" />
              </a>
              <Link
                href="/dashboard"
                className="group relative inline-flex h-9 items-center gap-1.5 overflow-hidden rounded-xl bg-white px-4 text-[13px] font-semibold text-black transition-transform active:scale-[0.97]"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-volt/60 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative">Open dashboard</span>
              </Link>
            </>
          )}
          <button
            className="grid h-9 w-9 place-items-center rounded-lg text-zinc-300 hover:bg-white/5 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="glass mx-auto mt-2 grid max-w-[1200px] gap-1 rounded-2xl !bg-[rgba(9,9,13,0.92)] p-2 md:hidden"
          >
            {[...links, ...(variant === "app" ? [{ href: "/account", label: "Account" }] : [{ href: "/dashboard", label: "Dashboard" }])].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-3 py-2.5 text-sm ${isActive(l.href) ? "bg-white/[0.06] text-white" : "text-zinc-300 hover:bg-white/[0.04]"}`}
              >
                {l.label}
              </Link>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
