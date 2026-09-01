import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { atomicWriteFile, backupExistingFile, fileExists } from "./fileRestore.js";

describe("fileRestore", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "envvault-file-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("atomicWriteFile creates file with 0600 and correct content", async () => {
    const p = path.join(tmp, ".env");
    await atomicWriteFile(p, "FOO=bar\n");
    expect(await fileExists(p)).toBe(true);
    expect(await fs.readFile(p, "utf-8")).toBe("FOO=bar\n");
    expect(await fileExists(p + ".envvault.tmp")).toBe(false);
    if (process.platform !== "win32") {
      const stat = await fs.stat(p);
      // 0600 => 0o100600, mask with 0o777
      expect(stat.mode & 0o777).toBe(0o600);
    }
  });

  it("atomicWriteFile is atomic (no partial file)", async () => {
    const p = path.join(tmp, ".env.local");
    await atomicWriteFile(p, "A=1\n");
    await atomicWriteFile(p, "B=2\n");
    expect(await fs.readFile(p, "utf-8")).toBe("B=2\n");
  });

  it("backupExistingFile creates dated backup and avoids overwrite", async () => {
    const p = path.join(tmp, ".env");
    await fs.writeFile(p, "ORIGINAL=1");
    const b1 = await backupExistingFile(p);
    expect(b1).toBeTruthy();
    expect(await fs.readFile(b1!, "utf-8")).toBe("ORIGINAL=1");
    // Second backup same day should get counter suffix
    await fs.writeFile(p, "MODIFIED=2");
    const b2 = await backupExistingFile(p);
    expect(b2).not.toBe(b1);
    expect(b2).toContain(".envvault-backup-");
    // No backup if file doesn't exist
    expect(await backupExistingFile(path.join(tmp, "nonexistent"))).toBe(null);
  });

  it("never leaves tmp on success", async () => {
    const p = path.join(tmp, ".env");
    await atomicWriteFile(p, "X=1");
    const entries = await fs.readdir(tmp);
    expect(entries.some((e) => e.includes(".envvault.tmp"))).toBe(false);
  });

  it("pull conflict handling respects backup-before-overwrite", async () => {
    const p = path.join(tmp, ".env");
    await fs.writeFile(p, "OLD=1");
    const backup = await backupExistingFile(p);
    await atomicWriteFile(p, "NEW=2");
    expect(await fs.readFile(p, "utf-8")).toBe("NEW=2");
    expect(await fs.readFile(backup!, "utf-8")).toBe("OLD=1");
  });
});
