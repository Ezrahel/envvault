import { SpiralField } from "@/components/landing/visuals";

/** Header banner + content column for marketing sub-pages (security, legal). */
export function DocShell({
  eyebrow,
  title,
  lead,
  children,
  wide = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/[0.05] pt-36 pb-16">
        <div className="absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_60%_80%_at_50%_30%,#000,transparent)]">
          <SpiralField />
        </div>
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_40%_60%_at_50%_45%,rgba(5,5,7,0.9),transparent)]" />
        <div className="relative mx-auto max-w-[820px] px-4 text-center sm:px-6">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-volt uppercase">
            <span className="h-px w-6 bg-volt/60" />
            {eyebrow}
            <span className="h-px w-6 bg-volt/60" />
          </div>
          <h1 className="text-gradient mt-4 text-[40px] leading-[1] font-semibold tracking-[-0.04em] sm:text-[60px]">{title}</h1>
          {lead && <p className="mx-auto mt-5 max-w-[580px] text-[15px] leading-7 text-zinc-400">{lead}</p>}
        </div>
      </section>
      <div className={`mx-auto px-4 pt-14 sm:px-6 ${wide ? "max-w-[1100px]" : "max-w-[760px]"}`}>{children}</div>
    </div>
  );
}

export function DocSection({ n, title, children }: { n?: string; title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl p-6">
      <h2 className="flex items-baseline gap-3 font-semibold">
        {n && <span className="font-mono text-xs text-volt">{n}</span>}
        {title}
      </h2>
      <div className="mt-3 space-y-2 text-sm leading-7 text-zinc-400 [&_li]:flex [&_li]:gap-2.5 [&_li]:before:mt-[11px] [&_li]:before:h-1 [&_li]:before:w-1 [&_li]:before:shrink-0 [&_li]:before:rounded-full [&_li]:before:bg-volt/70 [&_li]:before:content-['']">
        {children}
      </div>
    </section>
  );
}
