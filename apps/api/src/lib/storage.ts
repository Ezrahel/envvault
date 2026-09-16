import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Object Storage abstraction — per spec §67-68
 * Production: private R2/S3 bucket, no public access, encryption at rest, lifecycle, versioning, short-lived signed URLs
 * MVP: local filesystem fallback under data/object-storage with same objectKey scheme
 *
 * Object key: users/{userId}/projects/{projectId}/environments/{environmentId}/versions/{versionId}
 * Never place secret values in object names — we use IDs only.
 */

export interface StorageProvider {
  putObject(key: string, data: Buffer): Promise<void>;
  getObject(key: string): Promise<Buffer | null>;
  generateSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

class LocalStorage implements StorageProvider {
  private baseDir: string;

  constructor(baseDir = path.join(process.cwd(), "data", "object-storage")) {
    this.baseDir = baseDir;
  }

  private resolveKey(key: string): string {
    // Prevent path traversal
    const safe = key.replace(/\.\./g, "").replace(/^\/+/, "");
    return path.join(this.baseDir, safe);
  }

  async putObject(key: string, data: Buffer): Promise<void> {
    const full = this.resolveKey(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolveKey(key));
    } catch {
      return null;
    }
  }

  async generateSignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    // For local, return a mock signed URL that would be validated by API in prod
    // In prod this would be S3 getSignedUrl with SigV4
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    return `http://localhost:3001/v1/storage/signed/${encodeURIComponent(key)}?expires=${expiresAt}&sig=mock_${randomUUID().slice(0, 8)}`;
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolveKey(key));
    } catch {}
  }
}

class R2Storage implements StorageProvider {
  // Cloudflare R2 / S3-compatible storage: private bucket, SSE, short-lived signed URLs.
  private client: S3Client;
  private bucket: string;
  private localFallback = new LocalStorage();

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID!;
    this.bucket = process.env.R2_BUCKET!;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      // R2 requires path-style for some setups; virtual-hosted works with endpoint above.
      forcePathStyle: false,
    });
  }

  async putObject(key: string, data: Buffer): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ServerSideEncryption: "AES256" })
      );
    } catch (e) {
      // Fail open to local fallback would silently split storage locations — don't.
      // Surface the error so uploads visibly fail instead of vanishing.
      throw new Error(`R2 putObject failed: ${(e as Error).message}`);
    }
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!res.Body) return null;
      const chunks: Buffer[] = [];
      for await (const chunk of res.Body as any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }

  async generateSignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      // best-effort delete
    }
  }
}

function r2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  );
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

// Helper to build object key per spec §67
export function buildObjectKey(params: {
  userId: string;
  projectId: string;
  environmentId: string;
  versionId: string;
}): string {
  return `users/${params.userId}/projects/${params.projectId}/environments/${params.environmentId}/versions/${params.versionId}`;
}

// For MVP where we don't have projectId yet, use canonicalRemote-based key (backward compat)
export function buildLegacyObjectKey(params: {
  userId: string;
  canonicalRemote: string;
  environmentName: string;
  version: number;
}): string {
  return `users/${params.userId}/projects/${encodeURIComponent(params.canonicalRemote)}/environments/${params.environmentName}/versions/${params.version}`;
}
