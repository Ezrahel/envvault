import { createHmac } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { store } from "./store.js";

/**
 * Keyed hash of the client IP (never stored raw). Keyed with the JWT secret so
 * the 2^32 IPv4 space can't be brute-forced back from the hash.
 */
export function hashIp(ip: string): string {
  const key = process.env.JWT_SECRET ?? "envvault-dev-ip-key";
  return createHmac("sha256", key).update(ip).digest("hex").slice(0, 16);
}

/** Record a metadata-only audit event. Never throws — auditing must not fail a request. */
export async function auditLog(
  request: FastifyRequest,
  action: string,
  meta: { userId?: string | undefined; projectId?: string | undefined; deviceId?: string | undefined } = {},
): Promise<void> {
  const userId = request.user?.id ?? meta.userId;
  const deviceId = request.user?.deviceId ?? meta.deviceId;
  const projectId = meta.projectId;
  try {
    await store.audit({ userId, projectId, action, deviceId, ipHash: hashIp(request.ip ?? "unknown") });
  } catch (e) {
    request.log.warn({ err: (e as Error).message, action }, "audit write failed");
  }
  request.log.info({ event: action, userId, projectId, deviceId }, action);
}
