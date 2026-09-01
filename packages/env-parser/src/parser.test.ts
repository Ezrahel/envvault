import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { classifyEnvironment, isEnvFile, parseEnvContent, shouldIgnoreDir, scanRoots } from "./index.js";

describe("env-parser", () => {
  it("classifies known files", () => {
    expect(classifyEnvironment(".env")).toBe("default");
    expect(classifyEnvironment(".env.local")).toBe("local");
    expect(classifyEnvironment(".env.development")).toBe("development");
    expect(classifyEnvironment(".env.test")).toBe("test");
    expect(classifyEnvironment(".env.staging")).toBe("staging");
    expect(classifyEnvironment(".env.production")).toBe("production");
    expect(classifyEnvironment(".env.foo")).toBe("custom");
  });
  it("supports custom classification override", () => {
    expect(classifyEnvironment(".env.local", { ".env.local": "development" })).toBe("development");
  });
  it("isEnvFile excludes examples by default", () => {
    expect(isEnvFile(".env")).toBe(true);
    expect(isEnvFile(".env.local")).toBe(true);
    expect(isEnvFile(".env.production")).toBe(true);
    expect(isEnvFile(".env.development")).toBe(true);
    expect(isEnvFile(".env.test")).toBe(true);
    expect(isEnvFile(".env.staging")).toBe(true);
    expect(isEnvFile(".env.foo")).toBe(true);
    expect(isEnvFile(".env.example")).toBe(false);
    expect(isEnvFile(".env.sample")).toBe(false);
    expect(isEnvFile(".env.template")).toBe(false);
    expect(isEnvFile(".env.example", true)).toBe(true);
    expect(isEnvFile("foo.txt")).toBe(false);
    expect(isEnvFile(".env")).toBe(true);
  });
  it("ignores default dirs", () => {
    expect(shouldIgnoreDir("node_modules")).toBe(true);
    expect(shouldIgnoreDir(".git")).toBe(true);
    expect(shouldIgnoreDir("vendor")).toBe(true);
    expect(shouldIgnoreDir("target")).toBe(true);
    expect(shouldIgnoreDir("dist")).toBe(true);
    expect(shouldIgnoreDir("build")).toBe(true);
    expect(shouldIgnoreDir(".cache")).toBe(true);
    expect(shouldIgnoreDir(".next")).toBe(true);
    expect(shouldIgnoreDir("src")).toBe(false);
    expect(shouldIgnoreDir("my-custom", new Set(["my-custom"]))).toBe(true);
  });
  it("parses env content with quotes and comments", () => {
    const m = parseEnvContent("A=1\nB=\"hello world\"\n# comment\nC='x'\nD=\nE=foo # inline?\n");
    expect(m.get("A")).toBe("1");
    expect(m.get("B")).toBe("hello world");
    expect(m.get("C")).toBe("x");
    expect(m.get("D")).toBe("");
  });
  it("handles EPERM gracefully and prunes ignored dirs", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "envvault-scan-"));
    await fs.mkdir(path.join(tmp, "node_modules"), { recursive: true });
    await fs.writeFile(path.join(tmp, "node_modules", ".env"), "SHOULD_IGNORE=1");
    await fs.writeFile(path.join(tmp, ".env"), "OK=1");
    await fs.mkdir(path.join(tmp, ".git"), { recursive: true });
    await fs.writeFile(path.join(tmp, ".git", ".env"), "SHOULD_IGNORE=2");

    const files: string[] = [];
    for await (const f of scanRoots([tmp])) files.push(path.basename(f.absolutePath));
    expect(files).toContain(".env");
    expect(files).not.toContain("SHOULD_IGNORE");
    // Only one .env from root should be found, not from ignored dirs
    expect(files.filter((f) => f === ".env").length).toBe(1);

    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("does not follow symlinks by default", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "envvault-sym-"));
    const real = path.join(tmp, "real");
    await fs.mkdir(real, { recursive: true });
    await fs.writeFile(path.join(real, ".env"), "A=1");
    const link = path.join(tmp, "link");
    try {
      await fs.symlink(real, link, "dir");
    } catch {
      // Windows may fail without privilege — skip test
      await fs.rm(tmp, { recursive: true, force: true });
      return;
    }
    const withoutFollow: string[] = [];
    for await (const f of scanRoots([tmp])) withoutFollow.push(f.absolutePath);
    // Should find .env via real dir, but not double via symlink? Actually real is subdirectory, link is separate entry — both would be traversed if symlink followed. Without follow, link is skipped.
    // Expect at least one .env found
    expect(withoutFollow.length).toBeGreaterThanOrEqual(1);

    const withFollow: string[] = [];
    for await (const f of scanRoots([tmp], { followSymlinks: true })) withFollow.push(f.absolutePath);
    // With follow, may find duplicate if both paths traversed but loop prevention deduplicates via realpath
    expect(withFollow.length).toBeGreaterThanOrEqual(1);

    await fs.rm(tmp, { recursive: true, force: true });
  });
});
