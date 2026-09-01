import chalk from "chalk";
import inquirer from "inquirer";
import { pushCommand } from "./push.js";
import { pullCommand } from "./pull.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { findGitRoot, getOriginRemoteWithFallback, normalizeRemote } from "@envvault/git";
import { getConfigDir, loadConfig, saveConfig } from "@envvault/config";

export async function envListCommand(opts: { path?: string } = {}) {
  const cwd = opts.path ? path.resolve(opts.path) : process.cwd();
  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) {
    console.log(chalk.yellow("Not a git repository."));
    return;
  }
  const remote = await getOriginRemoteWithFallback(gitRoot);
  const identity = remote ? normalizeRemote(remote) : null;
  if (!identity) {
    console.log(chalk.yellow("No remote."));
    return;
  }

  const vaultDir = path.join(getConfigDir(), "vault", identity.canonicalRemote);
  try {
    const entries = await fs.readdir(vaultDir);
    console.log(chalk.bold(`Environments for ${identity.canonicalRemote}:`));
    for (const e of entries) {
      if (!e.endsWith(".json")) continue;
      const stat = await fs.stat(path.join(vaultDir, e));
      console.log(`  ${e.replace(/\.json$/, "")}  ${chalk.dim(stat.mtime.toISOString())}`);
    }
  } catch {
    console.log(chalk.dim("No local vault entries. Run envvault push."));
    // also try API
    try {
      const { getApiClient } = await import("../api/client.js");
      const api = await getApiClient();
      const projs = await api.listProjects();
      console.log(chalk.dim(`API projects: ${projs.length}`));
    } catch {}
  }
}

export async function envPushCommand(opts: { path?: string; all?: boolean } = {}) {
  return pushCommand(opts as any);
}

export async function envPullCommand(opts: { path?: string; force?: boolean } = {}) {
  return pullCommand(opts as any);
}

export async function envDeleteCommand(envName: string, opts: { path?: string; force?: boolean } = {}) {
  if (!envName) {
    console.error(chalk.red("Usage: envvault env delete <environment>"));
    process.exit(2);
  }
  const cwd = opts.path ? path.resolve(opts.path) : process.cwd();
  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) {
    console.error(chalk.red("Not a git repository."));
    process.exit(4);
  }
  const remote = await getOriginRemoteWithFallback(gitRoot);
  if (!remote) {
    console.error(chalk.red("No git remote."));
    process.exit(4);
  }
  const identity = normalizeRemote(remote);
  console.log(chalk.red(`This will permanently remove encrypted environment versions for:`));
  console.log(chalk.bold(`  ${identity.canonicalRemote} → ${envName}`));
  console.log(chalk.dim(`  (local vault + cloud if reachable)`));
  console.log("");

  if (!opts.force) {
    console.log(chalk.yellow("This will permanently remove encrypted environment versions."));
    console.log(chalk.dim("Type DELETE to confirm:"));
    const { confirm } = await inquirer.prompt<{ confirm: string }>([
      { type: "input", name: "confirm", message: ">" },
    ]);
    if (confirm !== "DELETE") {
      console.log(chalk.yellow("Aborted. Expected DELETE."));
      return;
    }
  }

  // Local vault
  const vaultDir = path.join(getConfigDir(), "vault", identity.canonicalRemote);
  let deletedLocal = 0;
  try {
    const entries = await fs.readdir(vaultDir);
    for (const e of entries) {
      if (!e.endsWith(".json")) continue;
      // Match by environment name via classification or fileName contains envName
      const fileName = e.replace(/\.json$/, "");
      // Simple: if envName is part of fileName or classification matches
      const classification = fileName === ".env" ? "default" : fileName.replace(".env.", "");
      if (fileName === envName || classification === envName || e.includes(envName)) {
        await fs.unlink(path.join(vaultDir, e));
        console.log(chalk.green(`  ✓ Deleted local ${e}`));
        deletedLocal++;
      }
    }
    // Also try exact match for files that were stored with envName
    // For MVP, also support deleting by fileName directly
    const exact = path.join(vaultDir, `${envName}.json`);
    try {
      await fs.unlink(exact);
      console.log(chalk.green(`  ✓ Deleted ${envName}.json`));
      deletedLocal++;
    } catch {}
  } catch {}

  // Cloud
  let deletedCloud = 0;
  try {
    const { getApiClient } = await import("../api/client.js");
    const api = await getApiClient();
    // For MVP, we don't have a direct delete env endpoint in API, so we list and simulate
    // In production, this would be DELETE /v1/projects/:id/environments/:name
    console.log(chalk.dim("  Checking cloud..."));
    // Try to list versions and delete via API if endpoint exists (future)
    // For now, just note that cloud deletion would require API support
    console.log(chalk.dim("  Cloud deletion not yet implemented in API — local vault cleared. Future: DELETE /v1/projects/:id/environments/:name"));
  } catch {}

  if (deletedLocal === 0) console.log(chalk.yellow("  No matching local files found."));
  console.log(chalk.green(`\nDone. Deleted ${deletedLocal} local file(s).`));
}

export async function envRenameCommand(fileName: string, newEnv: string, opts: { path?: string } = {}) {
  if (!fileName || !newEnv) {
    console.error(chalk.red("Usage: envvault env rename <file> <environment>"));
    console.error(chalk.dim("Example: envvault env rename .env.local development"));
    process.exit(2);
  }
  const cfg = await loadConfig();
  // Persist custom classification in config
  const customMap = (cfg as any).envClassification ?? {};
  customMap[fileName] = newEnv;
  (cfg as any).envClassification = customMap;
  await saveConfig(cfg);
  console.log(chalk.green(`✓ ${fileName} → ${newEnv}`));
  console.log(chalk.dim(`Saved to ${getConfigDir()}/config.json as envClassification`));
  console.log(chalk.dim(`Now: envvault push will use environment "${newEnv}" for ${fileName}`));
}
