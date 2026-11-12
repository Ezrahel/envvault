import * as React from "react";

/** Consistent page title block for app + marketing sub-pages. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 pb-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-[680px]">
        {eyebrow && (
          <div className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-volt uppercase">
            <span className="h-px w-5 bg-volt/60" />
            {eyebrow}
          </div>
        )}
        <h1 className="text-gradient text-[30px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[38px]">{title}</h1>
        {description && <p className="mt-3 text-sm leading-6 text-zinc-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-200">{children}</code>;
}

export function Note({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "volt" }) {
  return (
    <div
      className={`flex gap-3 rounded-2xl border p-4 text-xs leading-5 ${
        tone === "volt" ? "border-volt/20 bg-volt/[0.04] text-zinc-300" : "border-white/[0.07] bg-white/[0.02] text-zinc-400"
      }`}
    >
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone === "volt" ? "bg-volt shadow-[0_0_8px_var(--color-volt)]" : "bg-zinc-600"}`} />
      <div>{children}</div>
    </div>
  );
}
