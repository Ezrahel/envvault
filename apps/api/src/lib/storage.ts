import * as fs from "node:fs/promises";
import * as path from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Object storage for ciphertext envelopes.
 * Production: private Cloudflare R2 bucket (encrypted at rest by R2), short-lived signed URLs.
 * Fallback: local filesystem under data/object-storage with the same key scheme.
 *
 * Key: users/{userId}/projects/{projectId}/environments/{environmentName}/versions/{versionId}
 * All segments are UUIDs or charset-validated names — never secret values.
 */

export interface StorageProvider {
  putObject(key: string, data: Buffer): Promise<void>;
  getObject(key: string): Promise<Buffer | null>;
  generateSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/** A key is acceptable only if every segment is a plain name (no `..`, no empty segments). */
export function isSafeKey(key: string): boolean {
  if (!key || key.length > 1024 || key.startsWith("/")) return false;
  return key.split("/").every((seg) => SAFE_SEGMENT.test(seg) && seg !== "." && seg !== "..");
}

/** True if `key` is safe and inside the caller's own prefix. */
export function isOwnedKey(key: string, userId: string): boolean {
  return isSafeKey(key) && key.startsWith(`users/${userId}/`);
}

class LocalStorage implements StorageProvider {
  private baseDir: string;

  constructor(baseDir = process.env.LOCAL_STORAGE_DIR ?? path.join(process.cwd(), "data", "object-storage")) {
    this.baseDir = path.resolve(baseDir);
  }

  private resolveKey(key: string): string {
    if (!isSafeKey(key)) throw Object.assign(new Error("Invalid object key"), { statusCode: 400 });
    const full = path.resolve(this.baseDir, key);
    if (!full.startsWith(this.baseDir + path.sep)) throw Object.assign(new Error("Invalid object key"), { statusCode: 400 });
    return full;
  }

  async putObject(key: string, data: Buffer): Promise<void> {
    const full = this.resolveKey(key);
    await fs.mkdir(path.dirname(full), { recursive: true, mode: 0o700 });
    const tmp = `${full}.${process.pid}.tmp`;
    await fs.writeFile(tmp, data, { mode: 0o600 });
    await fs.rename(tmp, full);
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolveKey(key));
    } catch (e: any) {
      if (e?.code === "ENOENT" || e?.statusCode === 400) return null;
      throw e;
    }
  }

  async generateSignedUrl(key: string): Promise<string> {
    // Local mode has no presigner: point at the authenticated download route instead.
    const base = (process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 3001}`).replace(/\/+$/, "");
    return `${base}/v1/storage/signed/${encodeURIComponent(key)}`;
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolveKey(key));
    } catch {}
  }
}

class R2Storage implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.R2_BUCKET!;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      // Newer AWS SDKs add CRC32 checksum headers by default; only send them when required.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      maxAttempts: 3,
    });
  }

  async putObject(key: string, data: Buffer): Promise<void> {
    if (!isSafeKey(key)) throw Object.assign(new Error("Invalid object key"), { statusCode: 400 });
    try {
      await this.client.send(
        new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: "application/json" }),
      );
    } catch (e) {
      // Never fall back silently — a vanished upload is worse than a visible error.
      throw new Error(`Object storage write failed: ${(e as Error).name}`);
    }
  }

  async getObject(key: string): Promise<Buffer | null> {
    if (!isSafeKey(key)) return null;
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!res.Body) return null;
      return Buffer.from(await res.Body.transformToByteArray());
    } catch (e) {
      const name = (e as Error).name;
      if (name === "NoSuchKey" || name === "NotFound") return null;
      throw new Error(`Object storage read failed: ${name}`);
    }
  }

  async generateSignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresInSeconds });
  }

  async deleteObject(key: string): Promise<void> {
    if (!isSafeKey(key)) return;
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      // best-effort
    }
  }
}

export function r2Configured(): boolean {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
}

let singleton: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (singleton) return singleton;
  singleton = r2Configured() ? new R2Storage() : new LocalStorage();
  return singleton;
}

/** For tests: reset the singleton so env changes take effect. */
export function _resetStorage(): void {
  singleton = null;
}

export function buildObjectKey(params: { userId: string; projectId: string; environmentName: string; versionId: string }): string {
  return `users/${params.userId}/projects/${params.projectId}/environments/${params.environmentName}/versions/${params.versionId}`;
}
