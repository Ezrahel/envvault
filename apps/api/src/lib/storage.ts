import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

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

const USE_R2 = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID);

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
  // Placeholder for Cloudflare R2 / S3-compatible storage
  // In production, use @aws-sdk/client-s3 + @aws-sdk/s3-presigned-post
  private localFallback = new LocalStorage();

  async putObject(key: string, data: Buffer): Promise<void> {
    // TODO: implement with S3Client
    // const client = new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` })
    // await client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key, Body: data, ServerSideEncryption: "AES256" }))
    return this.localFallback.putObject(key, data);
  }

  async getObject(key: string): Promise<Buffer | null> {
    return this.localFallback.getObject(key);
  }

  async generateSignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    // TODO: generate presigned URL via getSignedUrl(client, new GetObjectCommand(...), { expiresIn })
    return this.localFallback.generateSignedUrl(key, expiresInSeconds);
  }

  async deleteObject(key: string): Promise<void> {
    return this.localFallback.deleteObject(key);
  }
}

let singleton: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (singleton) return singleton;
  singleton = USE_R2 ? new R2Storage() : new LocalStorage();
  return singleton;
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
