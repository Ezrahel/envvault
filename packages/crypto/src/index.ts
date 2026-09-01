import * as crypto from "node:crypto";
import type { EncryptedPayload } from "@envvault/shared";
import { CURRENT_CRYPTO_ALGORITHM, CURRENT_CRYPTO_FORMAT_VERSION } from "@envvault/shared";

export interface CryptoProvider {
  encrypt(plaintext: Uint8Array, associatedData?: Uint8Array): Promise<EncryptedPayload>;
  decrypt(payload: EncryptedPayload, associatedData?: Uint8Array): Promise<Uint8Array>;
}

export interface KeyProvider {
  getKey(keyVersion: number): Promise<Buffer>;
}

// Simple file/env derived key for MVP - in production use OS keychain + KDF
export function deriveKeyFromSecret(secret: string, salt: string = "envvault-salt-v1"): Buffer {
  // Use scrypt or pbkdf2? Use HKDF via scrypt for simplicity
  // For MVP: use SHA256 HKDF via crypto.hkdfSync or pbkdf2
  // We'll use crypto.scryptSync
  return crypto.scryptSync(secret, salt, 32);
}

export function generateKey(): Buffer {
  return crypto.randomBytes(32);
}

export function createAesGcmCrypto(key: Buffer, keyVersion = 1): CryptoProvider {
  if (key.length !== 32) throw new Error("Key must be 32 bytes for AES-256-GCM");

  return {
    async encrypt(plaintext: Uint8Array, associatedData?: Uint8Array): Promise<EncryptedPayload> {
      const nonce = crypto.randomBytes(12); // 96-bit nonce for GCM
      const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
      if (associatedData) cipher.setAAD(associatedData);

      const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // Combine ciphertext + authTag as base64? Keep separate fields per spec
      return {
        formatVersion: CURRENT_CRYPTO_FORMAT_VERSION,
        algorithm: CURRENT_CRYPTO_ALGORITHM,
        keyVersion,
        nonce: nonce.toString("base64"),
        ciphertext: encrypted.toString("base64"),
        authTag: authTag.toString("base64"),
      };
    },

    async decrypt(payload: EncryptedPayload, associatedData?: Uint8Array): Promise<Uint8Array> {
      if (payload.algorithm !== CURRENT_CRYPTO_ALGORITHM) {
        throw new Error(`Unsupported algorithm: ${payload.algorithm}`);
      }
      if (payload.formatVersion !== CURRENT_CRYPTO_FORMAT_VERSION) {
        throw new Error(`Unsupported formatVersion: ${payload.formatVersion}`);
      }
      const nonce = Buffer.from(payload.nonce, "base64");
      const ciphertext = Buffer.from(payload.ciphertext, "base64");
      const authTag = payload.authTag ? Buffer.from(payload.authTag, "base64") : null;

      if (nonce.length !== 12) throw new Error("Invalid nonce length");
      if (!authTag || authTag.length !== 16) throw new Error("Invalid authTag");

      const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
      if (associatedData) decipher.setAAD(associatedData);
      decipher.setAuthTag(authTag);

      try {
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return decrypted;
      } catch (e) {
        throw new Error("Decryption failed: authentication tag mismatch or corrupted payload");
      }
    },
  };
}

// Helper to create from secret string
export function createCryptoFromSecret(secret: string, keyVersion = 1): CryptoProvider {
  const key = deriveKeyFromSecret(secret);
  return createAesGcmCrypto(key, keyVersion);
}

// Envelope helpers for file encryption
export async function encryptFileContent(content: Buffer | string, secret: string): Promise<EncryptedPayload> {
  const provider = createCryptoFromSecret(secret);
  const buf = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
  return provider.encrypt(buf);
}

export async function decryptFileContent(payload: EncryptedPayload, secret: string): Promise<Buffer> {
  const provider = createCryptoFromSecret(secret);
  const out = await provider.decrypt(payload);
  return Buffer.from(out);
}

export * from "@envvault/shared";
