"use client";
import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "motion/react";
import { Search, Folder, Shield, Laptop, Clock, Copy, Layers, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";

const item =
  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-300 data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-white";
const group =
  "px-1 py-1.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:tracking-[0.2em] [&_[cmdk-group-heading]]:text-zinc-500 [&_[cmdk-group-heading]]:uppercase";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    window.location.href = href;
  };
  const copy = async (cmd: string) => {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(cmd);
      toast.success(`Copied: ${cmd}`);
    } catch {}
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-xs text-zinc-400 transition-colors hover:border-white/20 hover:text-white md:inline-flex"
      >
        <Search className="h-3 w-3" /> Search
        <kbd className="rounded border border-white/10 bg-black/40 px-1 font-mono text-[10px]">⌘K</kbd>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              className="glass mx-4 mt-[18vh] overflow-hidden rounded-2xl bg-ink-900/90 shadow-2xl sm:mx-auto sm:max-w-[560px]"
              onClick={(e) => e.stopPropagation()}
            >
              <Command>
                <div className="flex items-center gap-2 border-b border-white/[0.06] px-4">
                  <Search className="h-4 w-4 text-zinc-500" />
                  <Command.Input
                    placeholder="Search pages and commands…"
                    className="h-12 w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none focus-visible:outline-none"
                    autoFocus
                  />
                </div>
                <Command.List className="max-h-[340px] overflow-y-auto p-2" data-lenis-prevent>
                  <Command.Empty className="py-8 text-center text-sm text-zinc-500">No results.</Command.Empty>
                  <Command.Group heading="Navigate" className={group}>
                    <Command.Item onSelect={() => go("/dashboard")} className={item}><LayoutDashboard className="h-4 w-4 text-zinc-500" /> Overview</Command.Item>
                    <Command.Item onSelect={() => go("/projects")} className={item}><Folder className="h-4 w-4 text-zinc-500" /> Projects</Command.Item>
                    <Command.Item onSelect={() => go("/environments")} className={item}><Layers className="h-4 w-4 text-zinc-500" /> Environments</Command.Item>
                    <Command.Item onSelect={() => go("/versions")} className={item}><Clock className="h-4 w-4 text-zinc-500" /> Versions</Command.Item>
                    <Command.Item onSelect={() => go("/devices")} className={item}><Laptop className="h-4 w-4 text-zinc-500" /> Devices</Command.Item>
                    <Command.Item onSelect={() => go("/security")} className={item}><Shield className="h-4 w-4 text-zinc-500" /> Security model</Command.Item>
                  </Command.Group>
                  <Command.Group heading="Copy command" className={group}>
                    {["envvault scan", "envvault push --yes", "envvault pull --yes", "envvault backup --dry-run"].map((c) => (
                      <Command.Item key={c} onSelect={() => copy(c)} className={item}>
                        <Copy className="h-4 w-4 text-zinc-500" /> <span className="font-mono text-[13px]">{c}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                </Command.List>
              </Command>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
