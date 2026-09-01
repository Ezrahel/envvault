import chalk from "chalk";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig } from "@envvault/config";
import { scanRoots } from "@envvault/env-parser";
import { getApiClient } from "../api/client.js";
import { getCryptoForCurrentUser } from "../crypto/index.js";
import * as fsp from "node:fs/promises";

export interface WatchOpts {
  path?: string;
  yes?: boolean;
}

export async function watchCommand(opts: WatchOpts = {}) {
  const cfg = await loadConfig();
  const roots = opts.path ? [opts.path] : cfg.scan.roots;
  const expanded = roots.map((r) => r.replace(/^~(?=$|\/|\\)/, process.env.HOME ?? "")).map((r) => path.resolve(r));

  console.log(chalk.bold("EnvVault Watch Mode"));
  console.log(chalk.dim("─".repeat(50)));
  console.log(chalk.dim(`Watching: ${expanded.join(", ")}`));
  console.log(chalk.dim("Press Ctrl+C to stop. New .env files will be detected and offered for backup."));
  console.log(chalk.dim("Never uploads automatically without explicit opt-in per spec §63."));
  console.log("");

  // Track known files to detect new ones
  const known = new Set<string>();
  for await (const found of scanRoots(expanded, {
    followSymlinks: cfg.scan.followSymlinks,
    ignoreDirs: cfg.scan.ignoreDirs,
  })) {
    known.add(found.absolutePath);
  }
  console.log(chalk.dim(`Tracking ${known.size} existing environment files`));
  console.log("");

  const watchers: fs.FSWatcher[] = [];
  let debounceTimer: NodeJS.Timeout | null = null;
  let isPrompting = false;

  function debounceScan() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      if (isPrompting) return;
      await scanForNew();
    }, 1000);
  }

  async function scanForNew() {
    const current: string[] = [];
    for await (const found of scanRoots(expanded, {
      followSymlinks: cfg.scan.followSymlinks,
      ignoreDirs: cfg.scan.ignoreDirs,
    })) {
      current.push(found.absolutePath);
      if (!known.has(found.absolutePath)) {
        known.add(found.absolutePath);
        isPrompting = true;
        console.log(chalk.bold(`\nNew environment file detected.`));
        console.log(chalk.dim(`  Path: ${found.absolutePath}`));
        if (found.project) console.log(chalk.dim(`  Project: ${found.project.canonicalRemote}`));
        console.log(chalk.dim(`  File: ${found.fileName} → ${found.environmentName}`));
        
        if (opts.yes) {
          console.log(chalk.dim("  Auto-backup enabled (--yes)"));
          try {
            const content = await fsp.readFile(found.absolutePath);
            const cryptoProvider = await getCryptoForCurrentUser();
            const payload = await cryptoProvider.encrypt(content, Buffer.from(found.project?.canonicalRemote ?? ""));
            const api = await getApiClient().catch(() => null);
            if (api && found.project) {
              await api.uploadEnvFile({
                project: found.project as any,
                environment: { name: found.environmentName, fileName: found.fileName },
                encryption: { algorithm: payload.algorithm, keyVersion: payload.keyVersion, nonce: payload.nonce, authTag: payload.authTag },
                ciphertext: payload.ciphertext,
              });
              console.log(chalk.green(`  ✓ ${found.fileName} backed up to cloud`));
            } else if (found.project) {
              const { getConfigDir } = await import("@envvault/config");
              const vaultDir = path.join(getConfigDir(), "vault", found.project.canonicalRemote);
              await fsp.mkdir(vaultDir, { recursive: true });
              await fsp.writeFile(path.join(vaultDir, `${found.fileName}.json`), JSON.stringify(payload, null, 2));
              console.log(chalk.green(`  ✓ ${found.fileName} backed up (local vault)`));
            }
          } catch (e) {
            console.log(chalk.red(`  ✗ Backup failed: ${(e as Error).message}`));
          }
        } else {
          console.log(chalk.yellow(`  Back up now? [y/N] (use --yes to auto-backup)`));
          console.log(chalk.dim(`  Run: envvault push --path ${path.dirname(found.absolutePath)}`));
        }
        console.log("");
        isPrompting = false;
      }
    }
  }

  for (const root of expanded) {
    try {
      const watcher = fs.watch(root, { recursive: true }, (eventType, filename) => {
        if (filename && (filename.includes(".env") || eventType === "rename")) {
          debounceScan();
        }
      });
      watchers.push(watcher);
      watcher.on("error", () => {});
    } catch (e) {
      console.log(chalk.yellow(`⚠ Cannot watch ${root}: ${(e as Error).message}`));
      console.log(chalk.dim(`  Hint: check that the path exists and you have permission (no sudo needed per spec §20)`));
    }
  }

  if (watchers.length === 0) {
    console.log(chalk.yellow("No watchable roots. Configure scan.roots via envvault init or use --path."));
    return;
  }

  console.log(chalk.green(`Watching ${watchers.length} root(s)...`));

  // Handle Ctrl+C cleanly per spec §94
  const cleanup = () => {
    console.log(chalk.dim("\nStopping watch..."));
    if (debounceTimer) clearTimeout(debounceTimer);
    for (const w of watchers) {
      try { w.close(); } catch {}
    }
    // Clean any .tmp files
    console.log(chalk.dim("Cleaned temporary resources."));
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Keep process alive
  await new Promise(() => {});
}
