import chalk from "chalk";
import * as path from "node:path";
import { loadAuth } from "../auth/store.js";
import { loadConfig, getConfigPath } from "@envvault/config";
import { findGitRoot, getOriginRemoteWithFallback, normalizeRemote } from "@envvault/git";
import { isEnvFile } from "@envvault/env-parser";
import * as fs from "node:fs/promises";

export async function statusCommand(opts: { path?: string } = {}) {
  const cwd = opts.path ? path.resolve(opts.path) : process.cwd();
  const cfg = await loadConfig();
  const auth = await loadAuth();

  console.log(chalk.bold("EnvVault Status"));
  console.log(chalk.dim("─".repeat(40)));
  console.log(`Config: ${chalk.dim(getConfigPath())}`);
  console.log(`API: ${chalk.dim(cfg.apiUrl)}`);
  console.log(`Auth: ${auth?.email ? chalk.green(auth.email) : chalk.yellow("not logged in")}`);
  console.log(`Device: ${chalk.dim(auth?.deviceId ?? "—")}`);
  console.log(`CWD: ${chalk.dim(cwd)}`);

  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) {
    console.log(chalk.yellow("Git: not a git repository"));
  } else {
    console.log(`Git root: ${chalk.dim(gitRoot)}`);
    const remote = await getOriginRemoteWithFallback(gitRoot);
    if (!remote) {
      console.log(chalk.yellow("Git remote: none"));
    } else {
      try {
        const id = normalizeRemote(remote);
        console.log(`Git remote: ${chalk.green(id.canonicalRemote)} ${chalk.dim(`(${id.provider})`)}`);
      } catch {
        console.log(`Git remote: ${chalk.yellow(remote)} (unparsable)`);
      }
    }
  }

  // List env files in cwd
  try {
    const entries = await fs.readdir(cwd, { withFileTypes: true });
    const envs = entries.filter((e) => e.isFile() && isEnvFile(e.name)).map((e) => e.name);
    if (envs.length) {
      console.log(`Env files: ${chalk.green(envs.join(", "))}`);
    } else {
      console.log(`Env files: ${chalk.dim("none in current directory")}`);
    }
  } catch {}

  console.log(chalk.dim("─".repeat(40)));
}
