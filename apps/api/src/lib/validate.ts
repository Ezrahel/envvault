import { z } from "zod";

/** Shared input rules. Anything that ends up in an object key or path is strictly charset-limited. */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

/** Environment names: `default`, `local`, `staging`, `preview-2`… */
export const envNameSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "environment name may only contain letters, digits, '.', '_' and '-'");

/** File names: `.env`, `.env.local`, `.env.production.local` — never a path. */
export const fileNameSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9._-]+$/, "fileName must be a bare file name")
  .refine((v) => v !== "." && v !== ".." && !v.includes(".."), "fileName must be a bare file name");

/**
 * Canonical remote: `host/owner/repo` (GitLab subgroups, Azure `%20`, self-hosted
 * `host/repo` all allowed). Never used in storage paths (keys use the project UUID),
 * so we only reject whitespace/control chars, schemes and dot segments.
 */
export const canonicalRemoteSchema = z
  .string()
  .min(3)
  .max(512)
  .regex(/^[^\s/]+(\/[^\s/]+)+$/, "canonicalRemote must look like host/owner/repo")
  // eslint-disable-next-line no-control-regex
  .refine((v) => !/[\x00-\x1f\x7f]/.test(v) && !v.includes("://"), "canonicalRemote contains invalid characters")
  .refine((v) => !v.split("/").some((seg) => seg === "." || seg === ".."), "canonicalRemote must not contain dot segments");

export const projectIdentitySchema = z.object({
  provider: z.string().min(1).max(20),
  host: z.string().min(1).max(255),
  owner: z.string().max(255).optional(),
  repository: z.string().min(1).max(255),
  canonicalRemote: canonicalRemoteSchema,
});

const BASE64 = /^[A-Za-z0-9+/_-]+={0,2}$/;
export const base64Schema = (max: number) => z.string().min(1).max(max).regex(BASE64, "must be base64");

/** ~2 MB of ciphertext — env files are tiny; anything bigger is a mistake or abuse. */
export const MAX_CIPHERTEXT_B64 = 2 * 1024 * 1024;

export const uuidParam = z.object({ id: z.string().uuid() });

/** Turn a zod error into a short, client-safe message. */
export function zodMessage(err: z.ZodError): string {
  return err.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
    .join("; ");
}
