import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { AmbientBackground } from "@/components/site/ambient-background";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AmbientBackground />
      <SiteHeader variant="app" />
      <main className="mx-auto min-h-[calc(100vh-120px)] max-w-[1200px] px-4 pt-28 pb-10 sm:px-6">{children}</main>
      <SiteFooter compact />
    </>
  );
}
