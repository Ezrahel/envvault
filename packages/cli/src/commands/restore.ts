import chalk from "chalk";
import inquirer from "inquirer";
import { scanRoots } from "@envvault/env-parser";
import { loadConfig } from "@envvault/config";
import { findGitRoot, getOriginRemoteWithFallback, normalizeRemote } from "@envvault/git";
import { isEnvFile, classifyEnvironment } from "@envvault/env-parser";
import { getCryptoForCurrentUser } from "../crypto/index.js";
import { getApiClient } from "../api/client.js";
import { requireAuth } from "../auth/store.js";
import { atomicWriteFile, backupExistingFile, fileExists } from "../utils/fileRestore.js";
import * as path from "node:path";
import * as fs from "node:fs/promises";
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
  // Check if this dir is a git repo
  const hasGit = entries.some((e) => e.name === ".git");
  if (hasGit) {
    const remote = await getOriginRemoteWithFallback(dir);
    if (remote) {
      try {
        const id = normalizeRemote(remote);
        yield { gitRoot: dir, canonicalRemote: id.canonicalRemote };
      } catch {}
    }
    // Don't recurse into .git, but still check subdirs for nested repos (monorepo case - use nearest)
    // We still recurse into subdirs except .git to find nested repos
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === ".git") continue;
    if (ignoreDirs.has(entry.name)) continue;
    if (entry.isSymbolicLink()) continue;
    yield* walkForGitRepos(path.join(dir, entry.name), depth + 1, maxDepth, ignoreDirs, visited);
  }
}

export interface RestoreOpts {
  path?: string;
  force?: boolean;
  yes?: boolean;
  version?: string;
  local?: boolean;
}

export async function restoreCommand(opts: RestoreOpts = {}) {
  const cfg = await loadConfig();
  const repoMap = new Map<string, { repoPath: string; canonicalRemote: string }>();

  if (opts.path) {
    // Explicit path: use it (could be a repo or a roots directory)
    const target = path.resolve(opts.path);
    const gitRoot = await findGitRoot(target);
    if (gitRoot) {
      const remote = await getOriginRemoteWithFallback(gitRoot);
      if (remote) {
        try {
          const identity = normalizeRemote(remote);
          repoMap.set(identity.canonicalRemote, { repoPath: gitRoot, canonicalRemote: identity.canonicalRemote });
        } catch {}
      }
    }
    if (repoMap.size === 0) {
      // Treat as roots directory: find all git repos regardless of env files
      const ignoreSet = new Set<string>([...DEFAULT_IGNORE_DIRS, ...(cfg.scan.ignoreDirs ?? [])]);
      for await (const repo of findAllGitRepos([target], ignoreSet)) {
        if (!repoMap.has(repo.canonicalRemote)) {
          repoMap.set(repo.canonicalRemote, { repoPath: repo.gitRoot, canonicalRemote: repo.canonicalRemote });
        }
      }
    }
  } else {
    // No path: try cwd as repo, fallback to scanning configured roots (multi-project migrate)
    const cwd = process.cwd();
    const gitRoot = await findGitRoot(cwd);
    if (gitRoot) {
      const remote = await getOriginRemoteWithFallback(gitRoot);
      if (remote) {
        try {
          const identity = normalizeRemote(remote);
          repoMap.set(identity.canonicalRemote, { repoPath: gitRoot, canonicalRemote: identity.canonicalRemote });
        } catch {}
      }
    }
    if (repoMap.size === 0) {
      const roots = cfg.scan.roots;
      const expanded = roots.map((r) => r.replace(/^~(?=$|\/|\\)/, process.env.HOME ?? "")).map((r) => path.resolve(r));
      // Only scan if roots exist and are not empty
      if (expanded.length > 0 && expanded.some((p) => p !== "/")) {
        const ignoreSet = new Set<string>([...DEFAULT_IGNORE_DIRS, ...(cfg.scan.ignoreDirs ?? [])]);
        for await (const repo of findAllGitRepos(expanded, ignoreSet)) {
          if (!repoMap.has(repo.canonicalRemote)) {
            repoMap.set(repo.canonicalRemote, { repoPath: repo.gitRoot, canonicalRemote: repo.canonicalRemote });
          }
        }
      }
    }
  }

  if (repoMap.size === 0) {
    console.log(chalk.bold("EnvVault Migration Restore"));
    console.log(chalk.dim("─".repeat(50)));
    console.log(chalk.yellow("No Git repositories found."));
    console.log(chalk.dim("Hint: cd into a Git repository or configure scan roots via envvault init or use --path."));
    return;
  }

  console.log(chalk.bold("EnvVault Migration Restore"));
  console.log(chalk.dim("─".repeat(50)));
  if (repoMap.size === 1) {
    const only = [...repoMap.values()][0]!;
    console.log(chalk.dim(`Repository: ${only.canonicalRemote}`));
    console.log(chalk.dim(`Git root: ${only.repoPath}`));
  } else {
    console.log(chalk.dim(`Found ${repoMap.size} repositories`));
    for (const [canon, repo] of repoMap) {
      console.log(chalk.dim(`  ${canon} → ${repo.repoPath}`));
    }
  }
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

  let totalRestored = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const [canonicalRemote, repo] of repoMap) {
    console.log(chalk.bold(`\n${canonicalRemote}`));
    console.log(chalk.dim(`  Path: ${repo.repoPath}`));

    let payloads: Array<{ fileName: string; environmentName: string; payload: any }> = [];

    if (api) {
      const candidates = [".env", ".env.local", ".env.development", ".env.test", ".env.staging", ".env.production"];
      for (const f of candidates) {
        try {
          const versions = await api.listVersions(canonicalRemote, f);
          if (versions && versions.length > 0) {
            if (opts.version) {
              const wanted = (versions as any[]).find((v: any) => String(v.version) === String(opts.version));
              if (wanted) payloads.push({ fileName: f, environmentName: classifyEnvironment(f), payload: wanted });
              else {
                const latest = (versions as any[])[versions.length - 1]!;
                console.log(chalk.yellow(`  Version ${opts.version} not found for ${f}, using latest v${(latest as any).version}`));
                payloads.push({ fileName: f, environmentName: classifyEnvironment(f), payload: latest });
              }
            } else {
              const latest = (versions as any[])[versions.length - 1]!;
              payloads.push({ fileName: f, environmentName: classifyEnvironment(f), payload: latest });
            }
          }
        } catch {}
      }
      if (opts.version && payloads.length > 0) {
        console.log(chalk.dim(`  Requested version: ${opts.version}`));
      }
    }

    if (payloads.length === 0) {
      const { getConfigDir } = await import("@envvault/config");
      const vaultDir = path.join(getConfigDir(), "vault", canonicalRemote);
      try {
        const entries = await fs.readdir(vaultDir);
        for (const e of entries) {
          if (!e.endsWith(".json")) continue;
          const fileName = e.replace(/\.json$/, "");
          const raw = await fs.readFile(path.join(vaultDir, e), "utf-8");
          const payload = JSON.parse(raw);
          payloads.push({ fileName, environmentName: classifyEnvironment(fileName), payload });
        }
      } catch {}
    }

    if (payloads.length === 0) {
      console.log(chalk.yellow("  No backed up environments found for this repository."));
      continue;
    }

    console.log(chalk.green(`  Found ${payloads.length} backed up environment(s):`));
    for (const p of payloads) {
      console.log(`    • ${p.fileName} ${chalk.dim(`→ ${p.environmentName}`)}`);
    }

    let selected = payloads;
    if (!opts.yes && payloads.length > 1) {
      const ans = await inquirer.prompt<{ files: string[] }>([
        {
          type: "checkbox",
          name: "files",
          message: "Select environments to restore:",
          choices: payloads.map((p) => ({ name: p.fileName, value: p.fileName, checked: true })),
        },
      ]);
      selected = payloads.filter((p) => ans.files.includes(p.fileName));
      if (selected.length === 0) {
        console.log(chalk.yellow("  No files selected. Skipping."));
        continue;
      }
    }

    for (const item of selected) {
      const targetPath = path.join(repo.repoPath, item.fileName);
      const exists = await fileExists(targetPath);

      if (exists && !opts.force && !opts.yes) {
        console.log(chalk.yellow(`  ⚠ ${item.fileName} already exists.`));
        const { action } = await inquirer.prompt<{ action: string }>([
          {
            type: "list",
            name: "action",
            message: `Choose action for ${item.fileName}:`,
            choices: [
              { name: "Skip", value: "skip" },
              { name: "Backup existing then restore", value: "backup" },
              { name: "Overwrite", value: "overwrite" },
            ],
            default: "skip",
          },
        ]);
        if (action === "skip") {
          console.log(chalk.dim(`    Skipped ${item.fileName}`));
          totalSkipped++;
          continue;
        }
        if (action === "backup") {
          const backup = await backupExistingFile(targetPath);
          console.log(chalk.dim(`    Backup created: ${backup}`));
        }
      } else if (exists) {
        // --yes or --force: backup existing then restore
        const backup = await backupExistingFile(targetPath);
        console.log(chalk.dim(`    Backup created: ${backup}`));
      }

      console.log(chalk.dim(`  Restoring ${item.fileName}...`));
      try {
        const plaintext = await cryptoProvider.decrypt(item.payload, Buffer.from(canonicalRemote));
        await atomicWriteFile(targetPath, Buffer.from(plaintext));
        console.log(chalk.green(`  ✓ ${item.fileName} restored`));
        totalRestored++;
      } catch (e) {
        console.log(chalk.red(`  ✗ ${item.fileName} failed: ${(e as Error).message}`));
        totalFailed++;
      }
    }
  }

  console.log("");
  console.log(chalk.bold("Restore complete."));
  console.log(chalk.green(`  ✓ ${totalRestored} files restored`));
  if (totalSkipped > 0) console.log(chalk.dim(`  ⊘ ${totalSkipped} files skipped`));
  if (totalFailed > 0) console.log(chalk.red(`  ✗ ${totalFailed} files failed`));
}