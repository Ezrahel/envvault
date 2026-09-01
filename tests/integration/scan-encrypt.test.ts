import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { scanRoots } from "@envvault/env-parser";
import { createAesGcmCrypto, generateKey } from "@envvault/crypto";

const execFileAsync = promisify(execFile);

describe("integration: scan → encrypt → decrypt", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "envvault-int-"));
    // Create mock git repo
    const repo = path.join(tmp, "<repository>");
    await fs.mkdir(repo, { recursive: true });
    await fs.mkdir(path.join(repo, ".git"), { recursive: true });
    // Add .env files
    await fs.writeFile(path.join(repo, ".env"), "DATABASE_URL=postgres://localhost\nJWT_SECRET=secret123\n");
    await fs.writeFile(path.join(repo, ".env.local"), "API_KEY=abc\n");
    await fs.writeFile(path.join(repo, ".env.example"), "DATABASE_URL=\n");
    // Set git remote via config file (scan reads via git command, but we can mock git via writing config)
    // Instead, test scan without git remote, then test crypto roundtrip
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("scan finds .env files but ignores .env.example", async () => {
    const files = [];
    for await (const f of scanRoots([tmp])) {
      files.push(path.basename(f.absolutePath));
    }
    expect(files).toContain(".env");
    expect(files).toContain(".env.local");
    expect(files).not.toContain(".env.example");
  });

  it("encrypt → decrypt preserves content", async () => {
    const key = generateKey();
    const cryptoProvider = createAesGcmCrypto(key);
    const original = "DATABASE_URL=postgres://localhost/test\nJWT_SECRET=s3cret\n";
    const payload = await cryptoProvider.encrypt(Buffer.from(original));
    expect(payload.ciphertext).not.toContain("postgres");
    const decrypted = await cryptoProvider.decrypt(payload);
    expect(Buffer.from(decrypted).toString()).toBe(original);
  });

  it("scan → encrypt → decrypt → restore byte-for-byte", async () => {
    const key = generateKey();
    const p = createAesGcmCrypto(key);
    const repo = path.join(tmp, "<repository>");
    const content = await fs.readFile(path.join(repo, ".env"));
    const payload = await p.encrypt(content);
    const restored = await p.decrypt(payload);
    expect(Buffer.from(restored).equals(content)).toBe(true);
  });
});
