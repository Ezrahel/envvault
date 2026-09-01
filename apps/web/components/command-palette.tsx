"use client";
import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { Search, Folder, Shield, Laptop, Clock, Copy } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="hidden items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-400 hover:border-zinc-700 hover:text-white md:inline-flex">
        <Search className="h-3 w-3" /> ⌘K
      </button>
    );
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="mx-auto mt-[20vh] max-w-[520px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <Command className="bg-zinc-950">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-3">
            <Search className="h-4 w-4 text-zinc-500" />
            <Command.Input placeholder="Search projects, environments, commands…" className="h-11 w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none" autoFocus />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-zinc-500">No results.</Command.Empty>
            <Command.Group heading="Projects" className="px-2 py-1.5 text-[11px] font-medium tracking-widest text-zinc-500 uppercase">
              <Command.Item onSelect={() => (window.location.href = "/projects")} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
                <Folder className="h-4 w-4" /> Go to Projects
              </Command.Item>
              <Command.Item onSelect={() => (window.location.href = "/environments")} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
                <Folder className="h-4 w-4" /> Go to Environments
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Commands" className="px-2 py-1.5 text-[11px] font-medium tracking-widest text-zinc-500 uppercase">
              <Command.Item onSelect={() => { navigator.clipboard.writeText("envvault scan"); setOpen(false); }} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
                <Copy className="h-4 w-4" /> Copy: envvault scan
              </Command.Item>
              <Command.Item onSelect={() => { navigator.clipboard.writeText("envvault pull --yes"); setOpen(false); }} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
                <Copy className="h-4 w-4" /> Copy: envvault pull --yes
              </Command.Item>
            </Command.Group>
            <Command.Group heading="System" className="px-2 py-1.5 text-[11px] font-medium tracking-widest text-zinc-500 uppercase">
              <Command.Item onSelect={() => (window.location.href = "/security")} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
                <Shield className="h-4 w-4" /> Security
              </Command.Item>
              <Command.Item onSelect={() => (window.location.href = "/devices")} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
                <Laptop className="h-4 w-4" /> Devices
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
