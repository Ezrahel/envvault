export type GitProvider = "github" | "gitlab" | "bitbucket" | "unknown";

export interface ProjectIdentity {
  provider: GitProvider;
  host: string;
  owner?: string | undefined;
  repository: string;
  canonicalRemote: string;
  providerRepositoryId?: string | undefined; // GitHub stable ID for rename resilience (§109-110)
}

export interface EnvironmentFile {
  fileName: string;
  environmentName: string;
  absolutePath: string;
  project: ProjectIdentity;
  relativePath?: string | undefined;
}

export interface EncryptedPayload {
  formatVersion: number;
  algorithm: string;
  keyVersion: number;
  nonce: string;
  ciphertext: string;
  authTag?: string | undefined;
}

export interface ScanOptions {
  roots?: string[] | undefined;
  followSymlinks?: boolean | undefined;
  maxDepth?: number | undefined;
  ignoreDirs?: string[] | undefined;
}

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  INVALID_ARGS: 2,
  AUTH_FAILURE: 3,
  PROJECT_NOT_FOUND: 4,
  ENVIRONMENT_NOT_FOUND: 5,
  LOCAL_CONFLICT: 6,
  NETWORK_ERROR: 7,
  DECRYPTION_FAILURE: 8,
} as const;

export const ENV_CLASSIFICATION: Record<string, string> = {
  ".env": "default",
  ".env.local": "local",
  ".env.development": "development",
  ".env.test": "test",
  ".env.staging": "staging",
  ".env.production": "production",
};

export const IGNORED_ENV_FILES = new Set([
  ".env.example",
  ".env.sample",
  ".env.template",
]);

export const DEFAULT_IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "vendor",
  "target",
  "dist",
  "build",
  ".cache",
  ".next",
  ".turbo",
  "coverage",
]);

export const CURRENT_CRYPTO_FORMAT_VERSION = 1;
export const CURRENT_CRYPTO_ALGORITHM = "AES-256-GCM";
