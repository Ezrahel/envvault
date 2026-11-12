import { Laptop } from "lucide-react";
import { fetchDevices } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";
import { PageHeader, Code, Note } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

export default async function DevicesPage() {
  const devices = await fetchDevices();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Devices"
        title="Trusted devices"
        description={
          <>
            Each <Code>envvault login</Code> registers a device. If a laptop is stolen, revoke it: sessions expire, the keychain entry is useless,
            and future pushes fail.
          </>
        }
        actions={<Badge variant="volt">{devices.length} trusted</Badge>}
      />
      {devices.length === 0 ? (
        <Empty
          icon={Laptop}
          title="No devices yet"
          description={
            <>
              Run <Code>envvault login</Code> on a machine. Each device is stored with its platform and last-seen time.
            </>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {devices.map((d) => (
            <Card key={d.id} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <Laptop className="h-4 w-4 text-volt" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{d.name}</div>
                  <div className="truncate text-xs text-zinc-500">
                    {d.platform ?? "unknown"} · last seen {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "—"} ·{" "}
                    <span className="font-mono">{d.id.slice(0, 8)}</span>
                  </div>
                </div>
              </div>
              <Button variant="destructive" size="sm">
                Revoke
              </Button>
            </Card>
          ))}
        </div>
      )}
      <Note>Revoked devices can't push or pull. Session expiry and the OS keychain protect a stolen laptop.</Note>
    </div>
  );
}
