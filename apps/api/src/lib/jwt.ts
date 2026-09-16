import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * Minimal HS256 JWT — zero dependencies (no jose/jsonwebtoken needed).
 * Tokens are signed with JWT_SECRET, carry expiry, and are revocable by jti.
 */

export interface JwtPayload {
  sub: string; // user id
  email: string;
  jti: string;
  iat: number; // seconds
  exp: number; // seconds
  type: "access" | "refresh";
}

let cachedSecret: string | null = null;
let warnedEphemeral = false;

export function getJwtSecret(): string {
  if (cachedSecret) return cachedSecret;
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 32) {
    cachedSecret = s;
    return s;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production (min 32 chars). Generate with: openssl rand -base64 48");
  }
  // Dev/test fallback: ephemeral secret (tokens invalid after restart — safe, loud).
  if (!warnedEphemeral) {
    warnedEphemeral = true;
    console.warn("[auth] JWT_SECRET not set — using ephemeral dev secret. Set JWT_SECRET for stable tokens.");
  }
  cachedSecret = `dev-ephemeral-${randomUUID()}`;
  return cachedSecret;
}

/** For tests: reset cached secret so getJwtSecret re-reads env. */
export function _resetJwtSecretCache(): void {
  cachedSecret = null;
  warnedEphemeral = false;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

export function signJwt(claims: { sub: string; email: string; type?: "access" | "refresh"; expiresInSec?: number }): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const type = claims.type ?? "access";
  const ttl = claims.expiresInSec ?? defaultTtl(type);
  const payload: JwtPayload = {
    sub: claims.sub,
    email: claims.email,
    jti: randomUUID(),
    iat: nowSec,
    exp: nowSec + ttl,
    type,
  };
  const header = b64urlEncode(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }), "utf-8"));
  const body = b64urlEncode(Buffer.from(JSON.stringify(payload), "utf-8"));
  const sig = b64urlEncode(createHmac("sha256", getJwtSecret()).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

export function defaultTtl(type: "access" | "refresh"): number {
  if (type === "refresh") {
    const v = Number(process.env.JWT_REFRESH_TTL_SEC ?? 30 * 24 * 3600);
    return Number.isFinite(v) && v > 0 ? v : 30 * 24 * 3600;
  }
  const v = Number(process.env.JWT_ACCESS_TTL_SEC ?? 7 * 24 * 3600);
  return Number.isFinite(v) && v > 0 ? v : 7 * 24 * 3600;
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts as [string, string, string];
    const expected = b64urlEncode(createHmac("sha256", getJwtSecret()).update(`${header}.${body}`).digest());
    const a = Buffer.from(sig, "utf-8");
    const b = Buffer.from(expected, "utf-8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(b64urlDecode(body).toString("utf-8")) as JwtPayload;
    if (!payload.sub || !payload.exp) return null;
    if (payload.exp * 1000 < Date.now()) return null; // expired
    return payload;
  } catch {
    return null;
  }
}
