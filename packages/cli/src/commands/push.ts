import chalk from "chalk";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import inquirer from "inquirer";
import { findGitRoot, getOriginRemoteWithFallback, normalizeRemote } from "@envvault/git";
import { isEnvFile, classifyEnvironment } from "@envvault/env-parser";
import { getCryptoForCurrentUser } from "../crypto/index.js";
import { getApiClient } from "../api/client.js";
import { loadAuth, requireAuth } from "../auth/store.js";

export interface PushOpts {
  all?: boolean;
  path?: string;
  yes?: boolean;
  local?: boolean;
}

export async function pushCommand(opts: PushOpts = {}) {
  const cwd = opts.path ? path.resolve(opts.path) : process.cwd();
  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) {
    console.error(chalk.red("Not a git repository. Push requires a git repo to identify the project."));
    process.exit(4);
  }
  const remote = await getOriginRemoteWithFallback(gitRoot);
  if (!remote) {
    console.error(chalk.red("No git remote found. Set origin remote first."));
    process.exit(4);
  }
  let identity;
  try {
    identity = normalizeRemote(remote);
  } catch (e) {
    console.error(chalk.red(`Failed to normalize remote: ${remote}`));
    process.exit(1);
  }

  console.log(chalk.dim(`Repository:`));
  console.log(chalk.green(`  ${identity.canonicalRemote}`));
  console.log(chalk.dim(`  Git root: ${gitRoot}`));
  console.log("");

  // Detect env files recursively under gitRoot (monorepo support §107)
  // Use scanRoots for consistent discovery (handles nested apps/web/.env)
  const { scanRoots } = await import("@envvault/env-parser");
  const { loadConfig } = await import("@envvault/config");
  const cfg = await loadConfig();
  const discovered: Array<{ fileName: string; relativePath: string; fullPath: string }> = [];
  for await (const found of scanRoots([gitRoot], {
    followSymlinks: cfg.scan.followSymlinks,
    ignoreDirs: cfg.scan.ignoreDirs,
  })) {
    // Only include files that are under this gitRoot (scanRoots already does)
    // Ensure the file's gitRoot matches current repo (handles nested repos -> nearest)
    if (found.gitRoot !== gitRoot) continue;
    const rel = path.relative(gitRoot, found.absolutePath);
    discovered.push({ fileName: found.fileName, relativePath: rel, fullPath: found.absolutePath });
  }
  const envFiles = discovered.map((d) => d.relativePath);

  if (envFiles.length === 0) {
    console.log(chalk.yellow("No environment files found in repository root."));
    console.log(chalk.dim("Looked for: .env, .env.local, .env.development, etc. (excluding .env.example)"));
    return;
  }

  console.log(chalk.bold("Detected environments:"));
  envFiles.forEach((f, i) => console.log(`  ${i + 1}. ${f} ${chalk.dim(`→ ${classifyEnvironment(path.basename(f))}`)}`));
  console.log("");

  let selected: string[] = [];
  if (opts.all) {
    selected = envFiles;
  } else if (opts.yes) {
    selected = envFiles;
  } else {
    const ans = await inquirer.prompt<{ files: string[] }>([
      {
        type: "checkbox",
        name: "files",
        message: "Select files to backup:",
        choices: [
          ...envFiles.map((f) => ({ name: f, value: f, checked: true })),
          { name: "all", value: "__all__" },
        ],
      },
    ]);
    if (ans.files.includes("__all__")) selected = envFiles;
    else selected = ans.files.filter((v: string) => v !== "__all__");
    if (selected.length === 0) {
      console.log(chalk.yellow("No files selected. Aborting."));
      return;
    }
  }

  // Auth check
  try {
    await requireAuth();
  } catch {
    console.log(chalk.yellow("Not authenticated. Run envvault login first. Using local mock for MVP."));
  }

  // Consent
  if (!opts.yes) {
    console.log(chalk.dim(`\nEnvVault found ${selected.length} file(s). Secrets will be encrypted locally before upload.`));
    const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
      { type: "confirm", name: "confirm", message: "Continue?", default: true },
    ]);
    if (!confirm) {
      console.log(chalk.yellow("Aborted."));
      return;
    }
  }

  const cryptoProvider = await getCryptoForCurrentUser();
  let api: any = null;
  if (!opts.local) {
    try {
      api = await getApiClient();
    } catch {}
  } else {
    console.log(chalk.dim("Local mode: skipping cloud upload, using local vault only"));
  }

  for (const file of selected) {
    const fullPath = path.join(gitRoot, file);
    const baseName = path.basename(file);
    console.log(chalk.dim(`Encrypting ${file}...`));
    const content = await fs.readFile(fullPath);
    const payload = await cryptoProvider.encrypt(content, Buffer.from(identity.canonicalRemote));

    console.log(chalk.dim(`Uploading ${file}...`));
    // Server stores ciphertext only
    if (api) {
      try {
        // Debug: show baseUrl for troubleshooting
        const baseUrl = (api as any).baseUrl ?? (api as any).baseUrl ?? "unknown";
        if (process.env.DEBUG) console.log(chalk.dim(`  → ${baseUrl}/v1/environment-files/mock/versions`));
        await api.uploadEnvFile({
          project: identity,
          environment: { name: classifyEnvironment(baseName), fileName: file },
          encryption: {
            algorithm: payload.algorithm,
            keyVersion: payload.keyVersion,
            nonce: payload.nonce,
            authTag: payload.authTag,
          },
          ciphertext: payload.ciphertext,
        });
        console.log(chalk.green(`✓ ${file} backed up`));
        continue;
      } catch (e: any) {
        const cause = e.cause ? ` cause: ${e.cause.message ?? e.cause}` : "";
        console.log(chalk.yellow(`⚠ API upload failed for ${file}: ${e.message}${cause}`));
        if (process.env.DEBUG) console.log(chalk.dim(`  ${e.stack?.split("\n")[0]}`));
        console.log(chalk.dim(`  Storing locally as fallback (MVP)...`));
      }
    }

    // Local fallback storage (MVP without server): store in ~/.config/envvault/vault/
    const { getConfigDir } = await import("@envvault/config");
    const vaultDir = path.join(getConfigDir(), "vault", identity.canonicalRemote);
    await fs.mkdir(vaultDir, { recursive: true });
    const outPath = path.join(vaultDir, `${file}.json`);
    await fs.writeFile(outPath, JSON.stringify(payload, null, 2), "utf-8");
    console.log(chalk.green(`✓ ${file} backed up (local vault)`));
  }

  console.log(chalk.green("\nBackup complete."));
}
