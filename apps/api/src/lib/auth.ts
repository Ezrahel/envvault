import type { FastifyRequest, FastifyReply } from "fastify";
import { store } from "./store.js";
import { verifyJwt, type JwtPayload } from "./jwt.js";

export interface AuthUser {
  id: string;
  email: string;
  jti: string;
  exp: number;
  deviceId?: string | undefined;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

const lastTouch = new Map<string, number>();
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Resolve a token to a live user. Checks, in order: signature + expiry +
 * token type, jti revocation, user still exists, and (if the token is bound
 * to a device) that the device belongs to the user and isn't revoked.
 */
export async function resolveToken(token: string, type: "access" | "refresh"): Promise<{ user: AuthUser; payload: JwtPayload } | null> {
  const payload = verifyJwt(token, type);
  if (!payload) return null;
  if (await store.isJtiRevoked(payload.jti)) return null;
  const user = await store.getUserById(payload.sub);
  if (!user) return null;
  if (payload.did) {
    const device = await store.getDevice(user.id, payload.did);
    if (!device || device.revokedAt) return null;
  }
  return { user: { id: user.id, email: user.email, jti: payload.jti, exp: payload.exp, deviceId: payload.did }, payload };
}

export function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length >= 10 ? token : null;
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const token = bearer(request);
  if (!token) return reply.status(401).send({ error: "Unauthorized" });
  const resolved = await resolveToken(token, "access");
  if (!resolved) return reply.status(401).send({ error: "Invalid or expired token" });
  request.user = resolved.user;

  // Throttled last-seen update so the devices page is meaningful without a write per request.
  const did = resolved.user.deviceId;
  if (did && Date.now() - (lastTouch.get(did) ?? 0) > TOUCH_INTERVAL_MS) {
    lastTouch.set(did, Date.now());
    store.touchDevice(did).catch(() => {});
  }
}

export function requireUser(request: FastifyRequest): AuthUser {
  const u = request.user;
  if (!u) throw Object.assign(new Error("Not authenticated"), { statusCode: 401 });
  return u;
}
