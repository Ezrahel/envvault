import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader variant="marketing" />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
