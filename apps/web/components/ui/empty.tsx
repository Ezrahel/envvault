import { Folder, SearchX } from "lucide-react";
import { Button } from "./button";

export function Empty({
  icon: Icon = Folder,
  title,
  description,
  action,
}: {
  icon?: React.ElementType;
  title: string;
  description: React.ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="glass relative overflow-hidden rounded-2xl border-dashed px-6 py-14 text-center">
      <div aria-hidden className="bg-dots absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,#000,transparent_70%)]" />
      <div className="relative mx-auto grid h-14 w-14 place-items-center">
        <span className="animate-pulse-ring absolute inset-0 rounded-2xl border border-volt/30" />
        <span className="relative grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-ink-800">
          <Icon className="h-6 w-6 text-volt" />
        </span>
      </div>
      <h3 className="relative mt-5 text-sm font-semibold text-white">{title}</h3>
      <p className="relative mx-auto mt-1.5 max-w-[420px] text-xs leading-5 text-zinc-400">{description}</p>
      {action && (
        <div className="relative mt-5">
          {action.href ? (
            <a href={action.href}>
              <Button variant="primary" size="sm">{action.label}</Button>
            </a>
          ) : (
            <Button variant="primary" size="sm" onClick={action.onClick}>{action.label}</Button>
          )}
        </div>
      )}
    </div>
  );
}

export function EmptySearch({ onClear }: { onClear?: () => void }) {
  return (
    <div className="glass rounded-2xl px-6 py-10 text-center">
      <SearchX className="mx-auto h-8 w-8 text-zinc-600" />
      <p className="mt-2 text-sm text-zinc-400">No results found</p>
      {onClear && <button onClick={onClear} className="mt-2 text-xs text-volt underline decoration-volt/30 underline-offset-4">Clear filter</button>}
    </div>
  );
}
