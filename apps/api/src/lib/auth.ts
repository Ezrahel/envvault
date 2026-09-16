import type { FastifyRequest, FastifyReply } from "fastify";
import { store } from "./store.js";
import { verifyJwt } from "./jwt.js";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
  const token = header.slice(7);
  if (!token || token.length < 10) {
    return reply.status(401).send({ error: "Invalid token" });
  }

  // 1) Signed JWT (current). Enforces signature, expiry, and revocation.
  if (token.split(".").length === 3) {
    const payload = verifyJwt(token);
    if (!payload) {
      return reply.status(401).send({ error: "Invalid or expired token" });
    }
    if (await store.isJtiRevoked(payload.jti)) {
      return reply.status(401).send({ error: "Token revoked" });
    }
    // Confirm the user still exists (handles account deletion).
    const user = await store.getUserByEmail(payload.email);
    if (!user || user.id !== payload.sub) {
      return reply.status(401).send({ error: "Invalid or expired token" });
    }
    (request as any).user = { id: user.id, email: user.email, token, jti: payload.jti };
    const deviceId = request.headers["x-device-id"] as string | undefined;
    if (deviceId) (request as any).user.deviceId = deviceId;
    return;
  }

  // 2) Legacy opaque tokens (older CLI builds). Still honored so upgrades are seamless.
  const user = await store.getUserByToken(token);
  if (!user) {
    return reply.status(401).send({ error: "Invalid or expired token" });
  }
  // Attach authenticated user — distinct per token (fixes cross-user collision per §53)
  (request as any).user = { id: user.id, email: user.email, token };
  // Update last seen for device if present (optional header X-Device-Id)
  const deviceId = request.headers["x-device-id"] as string | undefined;
  if (deviceId) (request as any).user.deviceId = deviceId;
}

export function requireUser(request: FastifyRequest): { id: string; email: string; token?: string; jti?: string } {
  const u = (request as any).user;
  if (!u) throw new Error("Not authenticated");
  return u;
}
