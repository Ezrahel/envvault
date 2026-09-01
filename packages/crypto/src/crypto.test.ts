import { describe, it, expect } from "vitest";
import { createAesGcmCrypto, generateKey, deriveKeyFromSecret, createCryptoFromSecret } from "./index.js";

describe("crypto", () => {
  it("encrypt and decrypt roundtrip", async () => {
    const key = generateKey();
    const provider = createAesGcmCrypto(key);
    const plaintext = Buffer.from("DATABASE_URL=postgres://localhost\nJWT_SECRET=supersecret");
    const payload = await provider.encrypt(plaintext);
    const decrypted = await provider.decrypt(payload);
    expect(Buffer.from(decrypted).toString()).toBe(plaintext.toString());
    expect(payload.formatVersion).toBe(1);
    expect(payload.algorithm).toBe("AES-256-GCM");
    expect(payload.nonce).toBeTruthy();
    expect(payload.ciphertext).toBeTruthy();
    expect(payload.authTag).toBeTruthy();
  });

  it("each encrypt uses random nonce", async () => {
    const key = generateKey();
    const p = createAesGcmCrypto(key);
    const pt = Buffer.from("hello");
    const a = await p.encrypt(pt);
    const b = await p.encrypt(pt);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("fails with wrong key", async () => {
    const k1 = generateKey();
    const k2 = generateKey();
    const p1 = createAesGcmCrypto(k1);
    const p2 = createAesGcmCrypto(k2);
    const payload = await p1.encrypt(Buffer.from("secret"));
    await expect(p2.decrypt(payload)).rejects.toThrow(/Decryption failed/);
  });

  it("fails with tampered ciphertext", async () => {
    const key = generateKey();
    const p = createAesGcmCrypto(key);
    const payload = await p.encrypt(Buffer.from("secret"));
    const tampered = { ...payload, ciphertext: Buffer.from("tampered").toString("base64") };
    await expect(p.decrypt(tampered)).rejects.toThrow();
  });

  it("fails with tampered nonce", async () => {
    const key = generateKey();
    const p = createAesGcmCrypto(key);
    const payload = await p.encrypt(Buffer.from("secret"));
    const tampered = { ...payload, nonce: Buffer.from("000000000000").toString("base64") };
    await expect(p.decrypt(tampered)).rejects.toThrow();
  });

  it("fails with modified authTag", async () => {
    const key = generateKey();
    const p = createAesGcmCrypto(key);
    const payload = await p.encrypt(Buffer.from("secret"));
    const tampered = { ...payload, authTag: Buffer.alloc(16, 0).toString("base64") };
    await expect(p.decrypt(tampered)).rejects.toThrow();
  });

  it("supports associated data", async () => {
    const key = generateKey();
    const p = createAesGcmCrypto(key);
    const aad = Buffer.from("github.com/<username>/<repository>");
    const payload = await p.encrypt(Buffer.from("hello"), aad);
    const dec = await p.decrypt(payload, aad);
    expect(Buffer.from(dec).toString()).toBe("hello");
    await expect(p.decrypt(payload, Buffer.from("wrong"))).rejects.toThrow();
    await expect(p.decrypt(payload)).rejects.toThrow();
  });

  it("deriveKey deterministic", () => {
    const k1 = deriveKeyFromSecret("my-secret");
    const k2 = deriveKeyFromSecret("my-secret");
    expect(k1.equals(k2)).toBe(true);
  });

  it("secret helper roundtrip", async () => {
    const { encryptFileContent, decryptFileContent } = await import("./index.js");
    const payload = await encryptFileContent("FOO=bar", "test-secret");
    const out = await decryptFileContent(payload, "test-secret");
    expect(out.toString()).toBe("FOO=bar");
  });

  it("fails on corrupted payload (truncated ciphertext)", async () => {
    const key = generateKey();
    const p = createAesGcmCrypto(key);
    const payload = await p.encrypt(Buffer.from("secret"));
    const truncated = { ...payload, ciphertext: payload.ciphertext.slice(0, -4) };
    await expect(p.decrypt(truncated)).rejects.toThrow();
  });

  it("fails on unsupported crypto version/algorithm", async () => {
    const key = generateKey();
    const p = createAesGcmCrypto(key);
    const payload = await p.encrypt(Buffer.from("secret"));
    await expect(p.decrypt({ ...payload, formatVersion: 999 })).rejects.toThrow(/Unsupported formatVersion/);
    await expect(p.decrypt({ ...payload, algorithm: "CHACHA20" as any })).rejects.toThrow(/Unsupported algorithm/);
  });

  it("fails with invalid nonce length", async () => {
    const key = generateKey();
    const p = createAesGcmCrypto(key);
    const payload = await p.encrypt(Buffer.from("secret"));
    const bad = { ...payload, nonce: Buffer.from("short").toString("base64") };
    await expect(p.decrypt(bad)).rejects.toThrow(/Invalid nonce/);
  });

  it("fails with invalid authTag length", async () => {
    const key = generateKey();
    const p = createAesGcmCrypto(key);
    const payload = await p.encrypt(Buffer.from("secret"));
    const bad = { ...payload, authTag: Buffer.from("short").toString("base64") };
    await expect(p.decrypt(bad)).rejects.toThrow(/Invalid authTag/);
  });

  it("different salts produce different keys", () => {
    const k1 = deriveKeyFromSecret("same-secret", "salt-a");
    const k2 = deriveKeyFromSecret("same-secret", "salt-b");
    expect(k1.equals(k2)).toBe(false);
  });
});
