import { store } from "./store.js";
import type { FastifyRequest } from "fastify";
import { createHash } from "node:crypto";

export function hashIp(ip: string): string {
  // Hash IP for privacy per spec §31 audit_logs ip_hash
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function auditLog(
  request: FastifyRequest,
  action: string,
  meta: { userId?: string | undefined; projectId?: string | undefined; deviceId?: string | undefined } = {}
): Promise<void> {
  const userId = (request as any).user?.id ?? meta.userId;
  const projectId = meta.projectId;
  const deviceId = (request as any).user?.deviceId ?? meta.deviceId;
  const ip = (request.ip as string) ?? "unknown";
  const ipHash = hashIp(ip);

  // Never log secret values — only metadata
  if (action.includes("SECRET") || action.includes("DATABASE_URL")) {
    action = "[redacted]";
  }

  await store.audit({
    userId,
    projectId,
    action,
    deviceId,
    ipHash,
  });

  // Structured log for observability per §73
  (request as any).log?.info({ event: action, userId, projectId, deviceId }, action);
}
