import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { normalizeRemote, findGitRoot, getOriginRemoteWithFallback } from "@envvault/git";
import { createCryptoFromSecret } from "@envvault/crypto";
import { atomicWriteFile, backupExistingFile } from "../../packages/cli/src/utils/fileRestore.js";

const exec = promisify(execFile);

describe("e2e: real temp git repo roundtrip", () => {
  let tmp: string;
  let repoA: string;
  let repoB: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "envvault-e2e-"));
    repoA = path.join(tmp, "repo-a", "<repository>");
    repoB = path.join(tmp, "repo-b", "my-pdf-project");
    await fs.mkdir(repoA, { recursive: true });
    await fs.mkdir(repoB, { recursive: true });

    // Init real git repos
    for (const repo of [repoA, repoB]) {
      await exec("git", ["init"], { cwd: repo });
      await exec("git", ["remote", "add", "origin", "git@github.com:<username>/<repository>.git"], { cwd: repo });
      await exec("git", ["config", "user.email", "test@example.com"], { cwd: repo });
      await exec("git", ["config", "user.name", "Test"], { cwd: repo });
    }

    // Create .env in repoA
    await fs.writeFile(path.join(repoA, ".env"), "FOO=bar\nSECRET=s3cret\n");
    await fs.writeFile(path.join(repoA, ".env.local"), "LOCAL=1\n");
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("same git remote resolves to same EnvVault project regardless of path/username", async () => {
    const rootA = await findGitRoot(repoA);
    const rootB = await findGitRoot(repoB);
    expect(rootA).toBe(repoA);
    expect(rootB).toBe(repoB);

    const remoteA = await getOriginRemoteWithFallback(rootA!);
    const remoteB = await getOriginRemoteWithFallback(rootB!);
    const idA = normalizeRemote(remoteA!);
    const idB = normalizeRemote(remoteB!);

    expect(idA.canonicalRemote).toBe("github.com/<username>/<repository>");
    expect(idB.canonicalRemote).toBe("github.com/<username>/<repository>");
    expect(idA.canonicalRemote).toBe(idB.canonicalRemote);
    // Local paths differ, but identity same
    expect(repoA).not.toBe(repoB);
  });

  it("encrypt from repoA and restore to repoB verifies exact contents", async () => {
    const secret = "test-master-secret-for-e2e";
    const provider = createCryptoFromSecret(secret);

    const original = await fs.readFile(path.join(repoA, ".env"));
    const payload = await provider.encrypt(original, Buffer.from("github.com/<username>/<repository>"));

    // Simulate new machine clone at repoB (different folder, different username)
    const decrypted = await provider.decrypt(payload, Buffer.from("github.com/<username>/<repository>"));

    // Atomic restore to repoB
    await atomicWriteFile(path.join(repoB, ".env"), Buffer.from(decrypted));

    const restored = await fs.readFile(path.join(repoB, ".env"));
    expect(restored.equals(original)).toBe(true);

    // Test backup behavior
    await fs.writeFile(path.join(repoB, ".env"), "FOO=different\n");
    const backup = await backupExistingFile(path.join(repoB, ".env"));
    expect(backup).toBeTruthy();
    await atomicWriteFile(path.join(repoB, ".env"), Buffer.from(decrypted));
    expect((await fs.readFile(path.join(repoB, ".env"))).equals(original)).toBe(true);
  });

  it("nested repo uses nearest git root", async () => {
    // Create monorepo with nested git? Actually nearest git root should be inner if exists
    const outer = path.join(tmp, "monorepo");
    const inner = path.join(outer, "apps", "frontend");
    await fs.mkdir(inner, { recursive: true });
    await exec("git", ["init"], { cwd: outer });
    await exec("git", ["remote", "add", "origin", "git@github.com:<username>/platform.git"], { cwd: outer });
    // Inner has no .git, so nearest is outer
    const root = await findGitRoot(inner);
    expect(root).toBe(outer);
    // Now init inner as separate repo
    await exec("git", ["init"], { cwd: inner });
    await exec("git", ["remote", "add", "origin", "git@github.com:<username>/frontend.git"], { cwd: inner });
    const root2 = await findGitRoot(inner);
    expect(root2).toBe(inner);
  });

  it("worktree .git file is detected as repo root", async () => {
    const main = path.join(tmp, "worktree-main");
    await fs.mkdir(main, { recursive: true });
    await exec("git", ["init"], { cwd: main });
    // Simulate worktree: .git as file pointing to commondir
    await fs.rm(path.join(main, ".git"), { recursive: true, force: true });
    await fs.writeFile(path.join(main, ".git"), "gitdir: /tmp/fake/git/worktree\n");
    const root = await findGitRoot(main);
    expect(root).toBe(main);
    // Also test subdirectory of worktree
    const sub = path.join(main, "src");
    await fs.mkdir(sub, { recursive: true });
    const root2 = await findGitRoot(sub);
    expect(root2).toBe(main);
  });

  it("multiple local copies of same repo are detected as duplicates", async () => {
    const { scan } = await import("@envvault/env-parser");
    const copy1 = path.join(tmp, "dup1", "<repository>");
    const copy2 = path.join(tmp, "dup2", "<repository>");
    for (const dir of [copy1, copy2]) {
      await fs.mkdir(dir, { recursive: true });
      await exec("git", ["init"], { cwd: dir });
      await exec("git", ["remote", "add", "origin", "git@github.com:<username>/<repository>.git"], { cwd: dir });
      await fs.writeFile(path.join(dir, ".env"), "A=1\n");
    }
    const files = await scan([tmp]);
    const dupFiles = files.filter((f) => f.project?.canonicalRemote === "github.com/<username>/<repository>");
    expect(dupFiles.length).toBeGreaterThanOrEqual(2);
    // Group by canonical shows duplicates
    const byRemote = new Map<string, number>();
    for (const f of dupFiles) {
      const k = f.project!.canonicalRemote;
      byRemote.set(k, (byRemote.get(k) ?? 0) + 1);
    }
    expect(byRemote.get("github.com/<username>/<repository>")).toBeGreaterThanOrEqual(2);
  });

  it("CLI push → pull via spawned process restores byte-for-byte (local vault fallback)", async () => {
    const cli = path.resolve("packages/cli/dist/index.js");
    const configDir = path.join(tmp, ".envvault-cli-test");
    const envA = "DATABASE_URL=postgres://localhost\nJWT_SECRET=supersecret123\nPAYSTACK_SECRET_KEY=sk_test\n";
    await fs.writeFile(path.join(repoA, ".env"), envA);
    // login
    await exec("node", [cli, "login", "--email", "e2e@test.com"], { env: { ...process.env, ENVVAULT_CONFIG_DIR: configDir } } as any);
    // push with --yes
    await exec("node", [cli, "push", "--path", repoA, "--yes"], { env: { ...process.env, ENVVAULT_CONFIG_DIR: configDir } } as any);
    // Verify vault exists
    const vaultFile = path.join(configDir, "vault", "github.com/<username>/<repository>", ".env.json");
    const exists = await fs.stat(vaultFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    // Pull to repoB (different folder, simulating new laptop / different username)
    await exec("node", [cli, "pull", "--path", repoB, "--yes"], { env: { ...process.env, ENVVAULT_CONFIG_DIR: configDir } } as any);
    const restored = await fs.readFile(path.join(repoB, ".env"), "utf-8");
    expect(restored).toBe(envA);
    // Ensure server compromise would not expose plaintext: vault file is ciphertext
    const vaultPayload = JSON.parse(await fs.readFile(vaultFile, "utf-8"));
    expect(vaultPayload.ciphertext).not.toContain("supersecret123");
    expect(vaultPayload.ciphertext).not.toContain("postgres");
  }, 30000);
});
