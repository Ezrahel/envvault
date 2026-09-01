import { fetchDevices } from "../../lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Laptop } from "lucide-react";

export default async function DevicesPage() {
  const devices = await fetchDevices();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
        <Badge>{devices.length} trusted</Badge>
      </div>
      <p className="max-w-[640px] text-sm text-zinc-400">Each <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-xs">envvault login</code> registers a device. If a laptop is stolen, revoke it — sessions expire, OS keychain is cleared, and future pushes fail. Per spec §53.</p>
      {devices.length === 0 ? (
        <Card className="py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
            <Laptop className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No devices yet</h3>
          <p className="mx-auto mt-1 max-w-[400px] text-xs text-zinc-500">Run <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-xs">envvault login</code> on a machine. Device ID is stored with <code className="bg-zinc-900 px-1 rounded font-mono text-xs">platform</code> and <code className="bg-zinc-900 px-1 rounded font-mono text-xs">lastSeenAt</code>.</p>
          <div className="mx-auto mt-3 inline-block rounded-md border border-dashed border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">Example: MacBook Pro • Darwin • last seen 2h ago</div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {devices.map((d) => (
            <Card key={d.id} className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{d.name}</div>
                <div className="text-xs text-zinc-500">{d.platform ?? "unknown"} • last seen {d.lastSeenAt ? new Date(d.lastSeenAt as any).toLocaleString() : "—"} • {d.id.slice(0, 8)}</div>
              </div>
              <button className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white">Revoke</button>
            </Card>
          ))}
        </div>
      )}
      <div className="border-l-2 border-zinc-800 pl-3 text-xs text-zinc-500">You can revoke a device at any time. Revoked devices cannot push or pull. Session expiration + OS keychain protects stolen laptops per §53.</div>
    </div>
  );
}
