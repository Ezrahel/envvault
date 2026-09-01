#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { scanCommand } from "./commands/scan.js";
import { projectsCommand } from "./commands/projects.js";
import { statusCommand } from "./commands/status.js";
import { pushCommand } from "./commands/push.js";
import { pullCommand } from "./commands/pull.js";
import { backupCommand } from "./commands/backup.js";
import { restoreCommand } from "./commands/restore.js";
import { diffCommand } from "./commands/diff.js";
import { versionsCommand } from "./commands/versions.js";
import { watchCommand } from "./commands/watch.js";
import { restoreAllCommand } from "./commands/restoreAll.js";
import { envListCommand, envPushCommand, envPullCommand, envDeleteCommand, envRenameCommand } from "./commands/env.js";
import { projectLinkCommand } from "./commands/projectLink.js";
import { encryptCommand, decryptCommand } from "./commands/encrypt.js";
import { initCommand } from "./commands/init.js";
import { EXIT_CODES } from "@envvault/shared";

const program = new Command();

program
  .name("envvault")
  .description("EnvVault — project-aware encrypted .env backup & restore")
  .version("0.1.0");

program
  .command("login")
  .description("Authenticate via browser (GitHub OAuth preferred per spec §51)")
  .option("--email <email>", "email for mock login")
  .option("--github", "Login via GitHub OAuth (recommended)")
  .action(async (opts) => {
    try {
      await loginCommand(opts);
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

program
  .command("logout")
  .description("Log out and clear local credentials")
  .action(async () => {
    try {
      await logoutCommand();
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

program
  .command("init")
  .description("Initialize EnvVault config")
  .action(async () => {
    await initCommand();
  });

program
  .command("backup")
  .description("Backup all environment files across configured roots (migration)")
  .option("--path <path>", "Scan a specific path")
  .option("--yes", "Skip confirmation")
  .option("--dry-run", "Show what would be backed up without uploading")
  .option("--local", "Use local vault only, no cloud (sprint 2)")
  .action(async (opts) => {
    try {
      await backupCommand(opts);
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

program
  .command("restore")
  .description("Restore environment files for all repositories in configured roots (migration)")
  .option("--path <path>", "Scan a specific path")
  .option("--force", "Force overwrite with backup")
  .option("--yes", "Skip prompts")
  .option("--at-version <version>", "Restore specific version")
  .option("--local", "Use local vault only")
  .action(async (opts) => {
    try {
      await restoreCommand(opts);
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

program
  .command("scan")
  .description("Scan for .env files and associate with git repos")
  .option("--path <path>", "Scan a specific path")
  .option("--follow-symlinks", "Follow symlinks")
  .option("--json", "Output JSON")
  .action(async (opts) => {
    try {
      await scanCommand(opts);
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

program
  .command("projects")
  .description("List projects")
  .action(async () => {
    await projectsCommand();
  });

program
  .command("status")
  .description("Show EnvVault status for current directory")
  .option("--path <path>", "Path to check")
  .action(async (opts) => {
    await statusCommand(opts);
  });

program
  .command("push")
  .description("Encrypt and upload environment files for current repo")
  .option("--all", "Push all without prompt")
  .option("--path <path>", "Repo path")
  .option("--yes", "Skip confirmation")
  .option("--local", "Use local vault only")
  .action(async (opts) => {
    try {
      await pushCommand(opts);
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

program
  .command("pull")
  .description("Download and decrypt environment files for current repo")
  .option("--path <path>", "Repo path")
  .option("--force", "Force overwrite with backup")
  .option("--yes", "Skip prompts")
  .option("--at-version <version>", "Restore specific version (see envvault versions)")
  .option("--local", "Use local vault only")
  .action(async (opts) => {
    try {
      await pullCommand({ ...opts, version: opts.atVersion });
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

program
  .command("migrate")
  .description("Migration helper (alias for backup) — old laptop → backup")
  .option("--path <path>", "Scan a specific path")
  .option("--yes", "Skip confirmation")
  .option("--dry-run", "Show what would be backed up")
  .option("--local", "Use local vault only")
  .action(async (opts) => {
    try {
      await backupCommand(opts);
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

program
  .command("encrypt")
  .description("Local encrypt (sprint 2, no cloud) — encrypt file to .enc")
  .argument("<file>", "File to encrypt")
  .option("--out <out>", "Output file")
  .option("--key <secret>", "Encryption secret (or ENVVAULT_MASTER_KEY)")
  .action(async (file, opts) => {
    try {
      await encryptCommand(file, opts);
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

program
  .command("decrypt")
  .description("Local decrypt — decrypt .enc file")
  .argument("<file>", "File to decrypt")
  .option("--out <out>", "Output file")
  .option("--key <secret>", "Encryption secret")
  .action(async (file, opts) => {
    try {
      await decryptCommand(file, opts);
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

program
  .command("diff")
  .description("Compare local and remote environment (keys only, values hidden)")
  .option("--path <path>", "Repo path")
  .option("--file <file>", "Env file to compare", ".env")
  .action(async (opts) => {
    try {
      await diffCommand(opts);
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

program
  .command("versions")
  .description("List version history for an environment file")
  .option("--path <path>", "Repo path")
  .option("--file <file>", "Env file", ".env")
  .option("--json", "Output JSON")
  .action(async (opts) => {
    try {
      await versionsCommand(opts);
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

program
  .command("watch")
  .description("Watch configured roots for new .env files (never auto-upload without --yes)")
  .option("--path <path>", "Watch a specific path")
  .option("--yes", "Auto-backup new files (opt-in)")
  .action(async (opts) => {
    try {
      await watchCommand(opts);
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

program
  .command("restore-all")
  .description("Restore missing environment files for all repos under a path (only missing, per spec §66)")
  .option("--path <path>", "Root path to scan")
  .option("--force", "Overwrite existing files")
  .option("--local", "Use local vault only")
  .action(async (opts) => {
    try {
      await restoreAllCommand(opts);
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

const env = program.command("env").description("Environment management");

env
  .command("list")
  .description("List environments for current repo")
  .option("--path <path>", "Repo path")
  .action(async (opts) => {
    await envListCommand(opts);
  });

env
  .command("push")
  .description("Push environment (alias)")
  .option("--path <path>", "Repo path")
  .option("--all", "Push all")
  .action(async (opts) => {
    await envPushCommand(opts);
  });

env
  .command("pull")
  .description("Pull environment (alias)")
  .option("--path <path>", "Repo path")
  .option("--force", "Force overwrite")
  .action(async (opts) => {
    await envPullCommand(opts);
  });

env
  .command("delete")
  .description("Delete environment (requires typing DELETE)")
  .argument("<environment>", "Environment name or file")
  .option("--path <path>", "Repo path")
  .option("--force", "Skip DELETE confirmation")
  .action(async (envName, opts) => {
    try {
      await envDeleteCommand(envName, opts);
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

env
  .command("rename")
  .description("Rename/customize environment classification (§16)")
  .argument("<file>", "File like .env.local")
  .argument("<environment>", "New environment name")
  .option("--path <path>", "Repo path")
  .action(async (file, envName, opts) => {
    try {
      await envRenameCommand(file, envName, opts);
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

const project = program.command("project").description("Project management");

project
  .command("link")
  .description("Link current remote to previous canonical (handle renames §13)")
  .option("--to <canonical>", "Previous canonicalRemote")
  .option("--path <path>", "Repo path")
  .action(async (opts) => {
    try {
      await projectLinkCommand(opts);
    } catch (e) {
      console.error(chalk.red((e as Error).message));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

program
  .command("environments")
  .description("List environments (alias for env list)")
  .option("--path <path>", "Repo path")
  .action(async (opts) => {
    await envListCommand(opts);
  });

program
  .command("devices")
  .description("List devices")
  .action(async () => {
    const { loadAuth } = await import("./auth/store.js");
    const auth = await loadAuth();
    if (!auth?.token) {
      console.log(chalk.yellow("Not authenticated."));
      return;
    }
    try {
      const { getApiClient } = await import("./api/client.js");
      const api = await getApiClient();
      const res = await (api as any).f(`${(api as any).baseUrl}/v1/auth/devices`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const devices = await res.json();
      console.log(chalk.bold("Devices:"));
      for (const d of devices) console.log(`  ${d.name} ${chalk.dim(d.platform ?? "")} ${d.id.slice(0, 8)}`);
      if (devices.length === 0) console.log(chalk.dim("  No devices"));
    } catch (e) {
      console.error(chalk.red((e as Error).message));
    }
  });

// Handle unknown commands gracefully
program.on("command:*", (operands) => {
  console.error(chalk.red(`Unknown command: ${operands[0]}`));
  program.help({ error: true });
});

// Global error handling: never leak secrets
process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (/DATABASE_URL|JWT_SECRET|SECRET/.test(msg)) {
    console.error(chalk.red("An error occurred (secret redacted)"));
  } else {
    console.error(chalk.red(msg));
  }
  process.exit(EXIT_CODES.GENERAL_ERROR);
});

await program.parseAsync(process.argv);
