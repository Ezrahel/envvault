import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CommandPalette } from "@/components/command-palette";
import { Toaster } from "sonner";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "EnvVault — Your development environment, anywhere",
  description: "Project-aware encrypted .env backup & restore",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="font-sans bg-[#0a0a0a] text-zinc-50 antialiased">
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-[#0a0a0a]/80 backdrop-blur supports-[backdrop-filter]:bg-[#0a0a0a]/80">
          <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-white text-xs font-extrabold text-black">EV</div>
              <span className="text-[15px] font-bold tracking-tight">EnvVault</span>
              <span className="ml-1 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium tracking-widest text-zinc-400">MVP 0.1.0</span>
            </div>
            <nav className="hidden items-center gap-5 text-[13px] md:flex">
              <a href="/" className="text-zinc-400 hover:text-white transition-colors">Product</a>
              <a href="/#pricing" className="text-zinc-400 hover:text-white transition-colors">Pricing</a>
              <a href="/security" className="text-zinc-400 hover:text-white transition-colors">Security</a>
              <a href="/dashboard" className="text-white underline decoration-white underline-offset-8">Dashboard</a>
              <a href="/projects" className="text-zinc-400 hover:text-white transition-colors">Projects</a>
            </nav>
            <div className="flex items-center gap-2">
              <CommandPalette />
              <a href="/account" className="hidden h-7 w-7 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-xs text-zinc-400 hover:border-zinc-700 md:grid">A</a>
            </div>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-140px)] max-w-[1100px] px-6 py-6">{children}</main>
        <footer className="mt-8 border-t border-zinc-900 py-6 text-center text-xs text-zinc-500">
          EnvVault — Secrets are encrypted client-side. Server stores ciphertext only. ·{" "}
          <a href="/security" className="hover:text-zinc-300 underline decoration-zinc-700 underline-offset-4">Security</a> ·{" "}
          <a href="/privacy" className="hover:text-zinc-300 underline decoration-zinc-700 underline-offset-4">Privacy</a> ·{" "}
          <a href="/terms" className="hover:text-zinc-300 underline decoration-zinc-700 underline-offset-4">Terms</a> ·{" "}
          <a href="https://github.com" className="hover:text-zinc-300 underline decoration-zinc-700 underline-offset-4">Docs</a>
        </footer>
        <Toaster theme="dark" toastOptions={{ style: { background: "#171717", border: "1px solid #27272a", color: "#fafafa" } }} />
      </body>
    </html>
  );
}
