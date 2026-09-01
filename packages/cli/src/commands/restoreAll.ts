import chalk from "chalk";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { loadConfig } from "@envvault/config";
import { scanRoots } from "@envvault/env-parser";
import { findGitRoot, getOriginRemoteWithFallback, normalizeRemote } from "@envvault/git";
import { classifyEnvironment } from "@envvault/env-parser";
import { getCryptoForCurrentUser } from "../crypto/index.js";
import { getApiClient } from "../api/client.js";
import { requireAuth } from "../auth/store.js";
import { atomicWriteFile, fileExists } from "../utils/fileRestore.js";
import { DEFAULT_IGNORE_DIRS } from "@envvault/shared";

async function* findAllGitRepos(
  roots: string[],
  ignoreDirs: Set<string> = DEFAULT_IGNORE_DIRS,
  maxDepth = 8,
): AsyncIterable<{ gitRoot: string; canonicalRemote: string }> {
  for (const root of roots) {
    const resolved = path.resolve(root);
    yield* walkForGitRepos(resolved, 0, maxDepth, ignoreDirs, new Set<string>());
  }
}

async function* walkForGitRepos(
  dir: string,
  depth: number,
  maxDepth: number,
  ignoreDirs: Set<string>,
  visited: Set<string>,
): AsyncIterable<{ gitRoot: string; canonicalRemote: string }> {
  if (depth > maxDepth) return;
  try {
    const real = await fs.realpath(dir);
    if (visited.has(real)) return;
    visited.add(real);
  } catch {}
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const hasGit = entries.some((e) => e.name === ".git");
  if (hasGit) {
    const remote = await getOriginRemoteWithFallback(dir);
    if (remote) {
      try {
        const id = normalizeRemote(remote);
        yield { gitRoot: dir, canonicalRemote: id.canonicalRemote };
      } catch {}
    }
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === ".git") continue;
    if (ignoreDirs.has(entry.name)) continue;
    if (entry.isSymbolicLink()) continue;
    yield* walkForGitRepos(path.join(dir, entry.name), depth + 1, maxDepth, ignoreDirs, visited);
  }
}

export interface RestoreAllOpts {
  path?: string;
  force?: boolean;
  local?: boolean;
}

export async function restoreAllCommand(opts: RestoreAllOpts = {}) {
  const cfg = await loadConfig();
  const roots = opts.path ? [opts.path] : cfg.scan.roots;
  const expanded = roots.map((r) => r.replace(/^~(?=$|\/|\\)/, process.env.HOME ?? "")).map((r) => path.resolve(r));

  console.log(chalk.bold("EnvVault Restore All"));
  console.log(chalk.dim("─".repeat(50)));
  console.log(chalk.dim(`Scanning: ${expanded.join(", ")}`));
  console.log(chalk.dim("Algorithm: scan → find Git repos → identify remote → match project → restore missing only (§66)"));
  console.log("");

  try {
    await requireAuth();
  } catch {
    console.log(chalk.yellow("Not authenticated. Using local vault fallback."));
  }

  const cryptoProvider = await getCryptoForCurrentUser();
  let api: any = null;
  if (opts.local) {
    console.log(chalk.dim("Local mode: using local vault only (--local)"));
  } else {
    try {
      api = await getApiClient();
    } catch {}
  }

  const ignoreSet = new Set<string>([...DEFAULT_IGNORE_DIRS, ...(cfg.scan.ignoreDirs ?? [])]);
  const repos: Array<{ gitRoot: string; canonicalRemote: string }> = [];
  for await (const repo of findAllGitRepos(expanded, ignoreSet)) {
    if (!repos.some((r) => r.canonicalRemote === repo.canonicalRemote && r.gitRoot === repo.gitRoot)) {
      repos.push(repo);
    }
  }

  if (repos.length === 0) {
    console.log(chalk.yellow("No Git repositories found."));
    return;
  }

  console.log(chalk.dim(`Found ${repos.length} repositories`));
  console.log("");

  let totalRestored = 0;
  let totalSkippedExisting = 0;
  let totalNoBackup = 0;

  for (const repo of repos) {
    console.log(chalk.bold(`${repo.canonicalRemote}`));
    console.log(chalk.dim(`  Path: ${repo.gitRoot}`));

    const candidates = [".env", ".env.local", ".env.development", ".env.test", ".env.staging", ".env.production"];
    let restoredForRepo = 0;

    for (const fileName of candidates) {
      const targetPath = path.join(repo.gitRoot, fileName);
      if (await fileExists(targetPath) && !opts.force) {
        // Existing files remain untouched unless --force (§66)
        totalSkippedExisting++;
        continue;
      }

      let payload: any = null;
      if (api) {
        try {
          const versions = await api.listVersions(repo.canonicalRemote, fileName);
          if (versions && versions.length > 0) payload = versions[versions.length - 1];
        } catch {}
      }
      if (!payload) {
        const { getConfigDir } = await import("@envvault/config");
        const vaultPath = path.join(getConfigDir(), "vault", repo.canonicalRemote, `${fileName}.json`);
        try {
          const raw = await fs.readFile(vaultPath, "utf-8");
          payload = JSON.parse(raw);
        } catch {}
      }

      if (!payload) continue;

      // Only restore missing or --force
      if (await fileExists(targetPath) && !opts.force) continue;

      console.log(chalk.dim(`  Restoring ${fileName}...`));
      try {
        const plaintext = await cryptoProvider.decrypt(payload, Buffer.from(repo.canonicalRemote));
        await atomicWriteFile(targetPath, Buffer.from(plaintext));
        console.log(chalk.green(`  ✓ ${fileName} restored`));
        restoredForRepo++;
        totalRestored++;
      } catch (e) {
        console.log(chalk.red(`  ✗ ${fileName} failed: ${(e as Error).message}`));
      }
    }

    if (restoredForRepo === 0) {
      const hasAny = candidates.some((f) => false); // placeholder
      // Check if we skipped due to existing or no backup
      let hasBackup = false;
      for (const f of candidates) {
        if (api) {
          try {
            const v = await api.listVersions(repo.canonicalRemote, f);
            if (v && v.length > 0) { hasBackup = true; break; }
          } catch {}
        }
        if (!hasBackup) {
          const { getConfigDir } = await import("@envvault/config");
          try {
            await fs.access(path.join(getConfigDir(), "vault", repo.canonicalRemote, `${f}.json`));
            hasBackup = true;
            break;
          } catch {}
        }
      }
      if (hasBackup) {
        console.log(chalk.dim(`  (skipped — files already exist, use --force to overwrite)`));
      } else {
        console.log(chalk.dim(`  No backed up environments`));
        totalNoBackup++;
      }
    }
    console.log("");
  }

  console.log(chalk.bold("Restore All complete."));
  console.log(chalk.green(`  ✓ ${totalRestored} files restored`));
  if (totalSkippedExisting > 0) console.log(chalk.dim(`  ⊘ ${totalSkippedExisting} already existed (use --force)`));
  if (totalNoBackup > 0) console.log(chalk.dim(`  • ${totalNoBackup} repos had no backup`));
  console.log(chalk.dim("Existing files were untouched unless --force (spec §66)."));
}
