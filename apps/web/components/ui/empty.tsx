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
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950 px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
        <Icon className="h-6 w-6 text-zinc-500" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-1 max-w-[420px] text-xs text-zinc-400">{description}</p>
      {action && (
        <div className="mt-4">
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
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-6 py-8 text-center">
      <SearchX className="mx-auto h-8 w-8 text-zinc-600" />
      <p className="mt-2 text-sm text-zinc-400">No results found</p>
      {onClear && <button onClick={onClear} className="mt-2 text-xs text-zinc-300 underline decoration-zinc-700 underline-offset-4">Clear filter</button>}
    </div>
  );
}
