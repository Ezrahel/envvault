import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { SmoothScroll } from "@/components/site/smooth-scroll";

// NOTE: We intentionally avoid `next/font/google`. It fetches from
// fonts.googleapis.com at build time and breaks Docker / offline builds.
// Fonts are system stacks defined in globals.css (@theme --font-*).

export const metadata: Metadata = {
  title: "EnvVault — Your development environment, on any machine",
  description: "Project-aware, Git-native, client-side encrypted .env backup & restore. Clone. Pull. Run.",
};

export const viewport: Viewport = {
  themeColor: "#050507",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <SmoothScroll />
        {children}
        <Toaster
          theme="dark"
          toastOptions={{ style: { background: "#0e0e14", border: "1px solid rgba(255,255,255,0.1)", color: "#f4f4f6" } }}
        />
      </body>
    </html>
  );
}
