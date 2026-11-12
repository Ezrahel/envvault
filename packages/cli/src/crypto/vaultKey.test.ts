import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { deriveVaultKey } from "./vaultKey.js";
import { saveSession } from "../auth/session.js";
import { getCryptoForCurrentUser } from "./index.js";

const AAD = Buffer.from("github.com/acme/web");
const prevDir = process.env.ENVVAULT_CONFIG_DIR;

async function onMachine<T>(fn: () => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ev-machine-"));
  process.env.ENVVAULT_CONFIG_DIR = dir;
  try {
    return await fn();
  } finally {
    process.env.ENVVAULT_CONFIG_DIR = prevDir;
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const auth = { token: "t", userId: "u" };

describe("vault key", () => {
  afterEach(() => {
    delete process.env.ENVVAULT_MASTER_KEY;
  });

  it("is deterministic per (passphrase, email) and email is case-insensitive", () => {
    const a = deriveVaultKey("correct horse battery", "Dev@Example.com");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(deriveVaultKey("correct horse battery", "dev@example.com ")).toBe(a);
    expect(deriveVaultKey("correct horse batterY", "dev@example.com")).not.toBe(a);
    expect(deriveVaultKey("correct horse battery", "other@example.com")).not.toBe(a);
  });

  it("a backup sealed on machine A opens on machine B with the same passphrase — and only then", async () => {
    const sealed = await onMachine(async () => {
      await saveSession({ email: "dev@example.com", passphrase: "correct horse battery", auth });
      return (await getCryptoForCurrentUser()).encrypt(Buffer.from("SECRET=1\n"), AAD);
    });
    const opened = await onMachine(async () => {
      await saveSession({ email: "dev@example.com", passphrase: "correct horse battery", auth });
      return Buffer.from(await (await getCryptoForCurrentUser()).decrypt(sealed, AAD)).toString();
    });
    expect(opened).toBe("SECRET=1\n");

    await onMachine(async () => {
      await saveSession({ email: "dev@example.com", passphrase: "wrong passphrase!", auth });
      await expect((await getCryptoForCurrentUser()).decrypt(sealed, AAD)).rejects.toThrow(/vault passphrase/);
    });
  });

  it("keeps the previous key for decryption after the key changes on the same machine", async () => {
    await onMachine(async () => {
      await saveSession({ email: "dev@example.com", passphrase: "first passphrase", auth });
      const old = await (await getCryptoForCurrentUser()).encrypt(Buffer.from("OLD=1"), AAD);
      await saveSession({ email: "dev@example.com", passphrase: "second passphrase", auth });
      const c = await getCryptoForCurrentUser();
      expect(Buffer.from(await c.decrypt(old, AAD)).toString()).toBe("OLD=1");
    });
  });

  it("ENVVAULT_MASTER_KEY acts as the passphrase (CI)", async () => {
    const sealed = await onMachine(async () => {
      await saveSession({ email: "ci@example.com", passphrase: "ci-vault-passphrase", auth });
      return (await getCryptoForCurrentUser()).encrypt(Buffer.from("CI=1"), AAD);
    });
    await onMachine(async () => {
      await saveSession({ email: "ci@example.com", passphrase: "something-else-1", auth });
      process.env.ENVVAULT_MASTER_KEY = "ci-vault-passphrase";
      expect(Buffer.from(await (await getCryptoForCurrentUser()).decrypt(sealed, AAD)).toString()).toBe("CI=1");
    });
  });
});
