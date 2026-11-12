import { z } from "zod";

/**
 * Validated server environment — fail fast on boot in production,
 * warn-and-continue in dev/test so `pnpm dev` stays frictionless.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  JWT_ACCESS_TTL_SEC: z.coerce.number().int().positive().optional(),
  JWT_REFRESH_TTL_SEC: z.coerce.number().int().positive().optional(),
  CORS_ORIGINS: z.string().optional(), // comma-separated allowlist
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  // Reverse-proxy trust for client IPs (rate limiting + audit hashing).
  // "true" = trust X-Forwarded-For from any hop, a number = trust that many hops,
  // "false" = API is exposed directly. Default true (typical: behind a load balancer).
  TRUST_PROXY: z.string().default("true"),
  // Request rate limits per client IP per minute.
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  // Public base URL of this API (used in signed local-storage URLs).
  PUBLIC_API_URL: z.string().url().optional(),
  STORE_SNAPSHOT_PATH: z.string().optional(),
  STORE_SNAPSHOT_DISABLED: z.string().optional(),
});

export type ServerEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${parsed.error.message}`);
  }
  const env = parsed.data;
  const isProd = env.NODE_ENV === "production";

  if (isProd) {
    const problems: string[] = [];
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
      problems.push("JWT_SECRET must be set (min 32 chars). Generate: openssl rand -base64 48");
    }
    if (!env.DATABASE_URL) {
      problems.push("DATABASE_URL must be set (MVP runs in-memory + disk snapshot otherwise — data loss risk on multi-node).");
    }
    if (problems.length > 0) {
      throw new Error(`Production env misconfigured:\n- ${problems.join("\n- ")}`);
    }
    if (!!env.GITHUB_CLIENT_ID !== !!env.GITHUB_CLIENT_SECRET) {
      console.warn("[env] Only one of GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET is set — GitHub OAuth stays disabled.");
    }
    const r2 = [env.R2_ACCOUNT_ID, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY, env.R2_BUCKET].filter(Boolean).length;
    if (r2 > 0 && r2 < 4) {
      throw new Error("Production env misconfigured:\n- R2 is partially configured. Set all of R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (or none).");
    }
    if (!env.CORS_ORIGINS) {
      console.warn("[env] CORS_ORIGINS not set in production — API will reject browser origins except same-origin. Set to your app URL(s).");
    }
  }
  return env;
}

/** Parse CORS allowlist. Empty = no browser cross-origin access (same-origin/curl/CLI only). */
export function corsOrigins(env: Pick<ServerEnv, "CORS_ORIGINS" | "NODE_ENV">): (string | RegExp)[] | false {
  if (!env.CORS_ORIGINS) {
    // Dev convenience: allow localhost origins; prod: same-origin only until configured.
    return env.NODE_ENV === "production" ? false : [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];
  }
  return env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
}

export function trustProxySetting(v: string): boolean | number {
  const t = v.trim().toLowerCase();
  if (t === "false" || t === "0" || t === "") return false;
  if (t === "true") return true;
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : true;
}
