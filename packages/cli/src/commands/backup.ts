import chalk from "chalk";
import inquirer from "inquirer";
import { scanRoots } from "@envvault/env-parser";
import { loadConfig } from "@envvault/config";
import { findGitRoot, getOriginRemoteWithFallback, normalizeRemote } from "@envvault/git";
import { isEnvFile, classifyEnvironment } from "@envvault/env-parser";
import { getCryptoForCurrentUser } from "../crypto/index.js";
import { getApiClient } from "../api/client.js";
import { requireAuth } from "../auth/store.js";
import * as path from "node:path";
import * as fs from "node:fs/promises";

function parseCanonicalRemote(canonical: string): { provider: "github" | "gitlab" | "bitbucket" | "unknown"; host: string; owner: string; repository: string } {
  const parts = canonical.split("/");
  if (parts.length < 2) {
    return { provider: "unknown", host: parts[0] ?? "unknown", owner: "", repository: parts[1] ?? "unknown" };
  }
  const host = parts[0] as string;
  const repository = parts[parts.length - 1] as string;
  const owner = parts.length > 2 ? parts.slice(1, -1).join("/") : (parts[1] as string) ?? "";
  const provider = (host === "github.com" ? "github" : host === "gitlab.com" ? "gitlab" : host === "bitbucket.org" ? "bitbucket" : "unknown") as "github" | "gitlab" | "bitbucket" | "unknown";
  return { provider, host, owner, repository };
}

export interface BackupOpts {
  path?: string;
  yes?: boolean;
  dryRun?: boolean;
  local?: boolean;
}

export async function backupCommand(opts: BackupOpts = {}) {
  const cfg = await loadConfig();
  const roots = opts.path ? [opts.path] : cfg.scan.roots;
  const expanded = roots.map((r) => r.replace(/^~(?=$|\/|\\)/, process.env.HOME ?? "")).map((r) => path.resolve(r));

  console.log(chalk.bold("EnvVault Migration Backup"));
  console.log(chalk.dim("─".repeat(50)));
  console.log(chalk.dim("Scanning configured directories for Git repositories..."));
  console.log(chalk.dim(`Roots: ${expanded.join(", ")}`));
  console.log("");

  const discovered: Array<{
    repoPath: string;
    canonicalRemote: string;
    envFiles: Array<{ fileName: string; environmentName: string; fullPath: string }>;
  }> = [];

  const repoMap = new Map<string, { repoPath: string; canonicalRemote: string; envFiles: Array<{ fileName: string; environmentName: string; fullPath: string }> }>();

  for await (const found of scanRoots(expanded, {
    followSymlinks: cfg.scan.followSymlinks,
    ignoreDirs: cfg.scan.ignoreDirs,
  })) {
    if (!found.project) continue;
    const key = found.project.canonicalRemote;
    if (!repoMap.has(key)) {
      repoMap.set(key, {
        repoPath: found.gitRoot as string,
        canonicalRemote: key,
        envFiles: [],
      });
    }
    const repo = repoMap.get(key)!;
    repo.envFiles.push({
      fileName: found.fileName,
      environmentName: found.environmentName,
      fullPath: found.absolutePath,
    });
  }

  for (const [canonical, repo] of repoMap) {
    discovered.push(repo);
  }

  if (discovered.length === 0) {
    console.log(chalk.yellow("No Git repositories with environment files found."));
    return;
  }

  console.log(chalk.green(`Found ${discovered.length} repositories with environment files:`));
  console.log("");

  let totalFiles = 0;
  for (const repo of discovered) {
    console.log(chalk.bold(`  ${repo.canonicalRemote}`));
    console.log(chalk.dim(`    Path: ${repo.repoPath}`));
    for (const env of repo.envFiles) {
      console.log(`    • ${env.fileName} ${chalk.dim(`→ ${env.environmentName}`)}`);
      totalFiles++;
    }
  }
  console.log("");
  console.log(chalk.dim(`Total: ${discovered.length} repos, ${totalFiles} environment files`));
  console.log("");

  if (opts.dryRun) {
    console.log(chalk.yellow("Dry run complete. No files were backed up."));
    return;
  }

  if (!opts.yes) {
    console.log(chalk.dim(`${totalFiles} environment files will be encrypted and uploaded.`));
    const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
      { type: "confirm", name: "confirm", message: "Continue?", default: true },
    ]);
    if (!confirm) {
      console.log(chalk.yellow("Aborted."));
      return;
    }
  }

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

  let backedUp = 0;
  let failed = 0;

  for (const repo of discovered) {
    console.log(chalk.dim(`\nBacking up ${repo.canonicalRemote}...`));
    for (const env of repo.envFiles) {
      try {
        const content = await fs.readFile(env.fullPath);
        const payload = await cryptoProvider.encrypt(content, Buffer.from(repo.canonicalRemote));

        if (api) {
          try {
            const parsed = parseCanonicalRemote(repo.canonicalRemote);
            await api.uploadEnvFile({
              project: { provider: parsed.provider, host: parsed.host, owner: parsed.owner, repository: parsed.repository, canonicalRemote: repo.canonicalRemote },
              environment: { name: env.environmentName, fileName: env.fileName },
              encryption: {
                algorithm: payload.algorithm,
                keyVersion: payload.keyVersion,
                nonce: payload.nonce,
                authTag: payload.authTag,
              },
              ciphertext: payload.ciphertext,
            });
            console.log(chalk.green(`  ✓ ${env.fileName} backed up to cloud`));
            backedUp++;
            continue;
          } catch (e) {
            console.log(chalk.yellow(`  ⚠ Cloud upload failed for ${env.fileName}: ${(e as Error).message}`));
          }
        }

        const { getConfigDir } = await import("@envvault/config");
        const vaultDir = path.join(getConfigDir(), "vault", repo.canonicalRemote);
        await fs.mkdir(vaultDir, { recursive: true });
        const outPath = path.join(vaultDir, `${env.fileName}.json`);
        await fs.writeFile(outPath, JSON.stringify(payload, null, 2), "utf-8");
        console.log(chalk.green(`  ✓ ${env.fileName} backed up (local vault)`));
        backedUp++;
      } catch (e) {
        console.log(chalk.red(`  ✗ ${env.fileName} failed: ${(e as Error).message}`));
        failed++;
      }
    }
  }

  console.log("");
  console.log(chalk.bold("Backup complete."));
  console.log(chalk.green(`  ✓ ${backedUp} files backed up`));
  if (failed > 0) console.log(chalk.red(`  ✗ ${failed} files failed`));
}