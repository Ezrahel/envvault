import chalk from "chalk";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import inquirer from "inquirer";
import { findGitRoot, getOriginRemoteWithFallback, normalizeRemote } from "@envvault/git";
import { getCryptoForCurrentUser } from "../crypto/index.js";
import { getApiClient } from "../api/client.js";
import { requireAuth } from "../auth/store.js";
import { atomicWriteFile, backupExistingFile, fileExists } from "../utils/fileRestore.js";
import { classifyEnvironment } from "@envvault/env-parser";

export interface PullOpts {
  path?: string;
  force?: boolean;
  yes?: boolean;
  version?: string;
  local?: boolean;
}

export async function pullCommand(opts: PullOpts = {}) {
  const cwd = opts.path ? path.resolve(opts.path) : process.cwd();
  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) {
    console.error(chalk.red("Not a git repository. Pull must run inside a git repo."));
    process.exit(4);
  }
  const remote = await getOriginRemoteWithFallback(gitRoot);
  if (!remote) {
    console.error(chalk.red("No git remote found."));
    process.exit(4);
  }
  const identity = normalizeRemote(remote);
  console.log(chalk.dim(`Repository: ${identity.canonicalRemote}`));

  try {
    await requireAuth();
  } catch {
    console.log(chalk.yellow("Not authenticated, but continuing with local vault for MVP..."));
  }

  // Discover available backups: try API then local vault
  let payloads: Array<{ fileName: string; environmentName: string; payload: any }> = [];

  if (!opts.local) {
    try {
      const api = await getApiClient();
      // Try to list versions for common files – MVP: attempt to fetch .env, .env.local etc.
      const candidates = [".env", ".env.local", ".env.development", ".env.test", ".env.staging", ".env.production"];
      for (const f of candidates) {
        try {
          const versions = await api.listVersions(identity.canonicalRemote, f);
          if (versions && versions.length > 0) {
            if (opts.version) {
              const wanted = (versions as any[]).find((v: any) => String(v.version) === String(opts.version));
              if (wanted) payloads.push({ fileName: f, environmentName: classifyEnvironment(f), payload: wanted });
              else if (versions.length > 0) {
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
        console.log(chalk.dim(`Requested version: ${opts.version}`));
      }
    } catch {}
  } else {
    console.log(chalk.dim("Local mode: using local vault only"));
  }

  // Local vault fallback (also used if --local or API had no results)
  if (payloads.length === 0) {
    const { getConfigDir } = await import("@envvault/config");
    const vaultDir = path.join(getConfigDir(), "vault", identity.canonicalRemote);
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
    console.log(chalk.yellow("No backed up environments found for this repository."));
    console.log(chalk.dim("Run envvault push from the original machine first."));
    return;
  }

  console.log(chalk.bold("\nAvailable environments:"));
  payloads.forEach((p, i) => console.log(`  ${i + 1}. ${p.fileName} ${chalk.dim(`→ ${p.environmentName}`)}`));

  let selected = payloads;
  if (payloads.length > 1 && !opts.yes) {
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
      console.log(chalk.yellow("No files selected."));
      return;
    }
  }

  const cryptoProvider = await getCryptoForCurrentUser();

  for (const item of selected) {
    const targetPath = path.join(gitRoot, item.fileName);
    const exists = await fileExists(targetPath);

    if (exists && !opts.force) {
      console.log(chalk.yellow(`\n⚠ ${item.fileName} already exists.`));
      const { action } = await inquirer.prompt<{ action: string }>([
        {
          type: "list",
          name: "action",
          message: `Choose action for ${item.fileName}:`,
          choices: [
            { name: "Abort", value: "abort" },
            { name: "Backup existing file then restore", value: "backup" },
            { name: "Overwrite", value: "overwrite" },
            { name: "Diff (show variable names)", value: "diff" },
          ],
          default: "abort",
        },
      ]);
      if (action === "abort") {
        console.log(chalk.dim(`  Skipped ${item.fileName}`));
        continue;
      }
      if (action === "diff") {
        try {
          const existing = await fs.readFile(targetPath, "utf-8");
          const existingKeys = existing
            .split("\n")
            .filter((l) => l.trim() && !l.trim().startsWith("#"))
            .map((l) => l.split("=")[0]?.trim())
            .filter(Boolean);
          console.log(chalk.dim(`  Existing keys: ${existingKeys.join(", ") || "(none)"}`));
        } catch {}
        // Re-prompt after diff
        const { action2 } = await inquirer.prompt<{ action2: string }>([
          {
            type: "list",
            name: "action2",
            message: `Choose action for ${item.fileName}:`,
            choices: [
              { name: "Abort", value: "abort" },
              { name: "Backup existing file then restore", value: "backup" },
              { name: "Overwrite", value: "overwrite" },
            ],
            default: "abort",
          },
        ]);
        if (action2 === "abort") continue;
        if (action2 === "backup") {
          const backup = await backupExistingFile(targetPath);
          console.log(chalk.dim(`  Backup created: ${backup}`));
        }
      } else if (action === "backup") {
        const backup = await backupExistingFile(targetPath);
        console.log(chalk.dim(`  Backup created: ${backup}`));
      }
      // overwrite continues
    } else if (exists && opts.force) {
      const backup = await backupExistingFile(targetPath);
      console.log(chalk.dim(`  Backup (force): ${backup}`));
    }

    console.log(chalk.dim(`Downloading ${item.fileName}...`));
    // Decrypt locally
    let plaintext: Uint8Array;
    try {
      plaintext = await cryptoProvider.decrypt(item.payload, Buffer.from(identity.canonicalRemote));
    } catch (e) {
      console.error(chalk.red(`Failed to decrypt ${item.fileName}: ${(e as Error).message}`));
      process.exit(8);
    }

    await atomicWriteFile(targetPath, Buffer.from(plaintext));
    console.log(chalk.green(`✓ ${item.fileName} restored`));
  }

  console.log(chalk.green("\nRestore complete."));
}
