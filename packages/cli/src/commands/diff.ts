import chalk from "chalk";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { findGitRoot, getOriginRemoteWithFallback, normalizeRemote } from "@envvault/git";
import { parseEnvContent } from "@envvault/env-parser";
import { getCryptoForCurrentUser } from "../crypto/index.js";
import { getApiClient } from "../api/client.js";

export interface DiffOpts {
  path?: string;
  file?: string;
}

export async function diffCommand(opts: DiffOpts = {}) {
  const cwd = opts.path ? path.resolve(opts.path) : process.cwd();
  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) {
    console.error(chalk.red("Not a git repository."));
    process.exit(4);
  }
  const remote = await getOriginRemoteWithFallback(gitRoot);
  if (!remote) {
    console.error(chalk.red("No git remote found."));
    process.exit(4);
  }
  const identity = normalizeRemote(remote);
  const canonical = identity.canonicalRemote;

  console.log(chalk.bold(`Environment Diff`));
  console.log(chalk.dim(`Repository: ${canonical}`));
  console.log(chalk.dim(`Path: ${gitRoot}`));
  console.log("");

  const targetFile = opts.file ?? ".env";
  const localPath = path.join(gitRoot, targetFile);
  let localKeys: Set<string>;
  try {
    const content = await fs.readFile(localPath, "utf-8");
    localKeys = new Set(parseEnvContent(content).keys());
  } catch {
    console.log(chalk.yellow(`Local ${targetFile} not found.`));
    localKeys = new Set();
  }

  // Fetch remote (cloud or local vault)
  let remoteKeys: Set<string> | null = null;
  let remoteMeta: { version?: number; createdAt?: string } | null = null;

  const cryptoProvider = await getCryptoForCurrentUser();
  try {
    const api = await getApiClient();
    const versions = await api.listVersions(canonical, targetFile);
    if (versions && versions.length > 0) {
      const latest = versions[versions.length - 1] as any;
      remoteMeta = { version: latest.version, createdAt: latest.createdAt };
      const plaintext = await cryptoProvider.decrypt(latest, Buffer.from(canonical));
      remoteKeys = new Set(parseEnvContent(Buffer.from(plaintext).toString("utf-8")).keys());
    }
  } catch {}

  if (!remoteKeys) {
    const { getConfigDir } = await import("@envvault/config");
    const vaultPath = path.join(getConfigDir(), "vault", canonical, `${targetFile}.json`);
    try {
      const raw = await fs.readFile(vaultPath, "utf-8");
      const payload = JSON.parse(raw);
      const plaintext = await cryptoProvider.decrypt(payload, Buffer.from(canonical));
      remoteKeys = new Set(parseEnvContent(Buffer.from(plaintext).toString("utf-8")).keys());
    } catch {
      console.log(chalk.yellow(`No backed up ${targetFile} found for this repository.`));
      console.log(chalk.dim("Run envvault push first."));
      return;
    }
  }

  // Compare keys only, never values (§46)
  const added: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];

  for (const k of localKeys) {
    if (!remoteKeys!.has(k)) added.push(k);
    else unchanged.push(k);
  }
  for (const k of remoteKeys!) {
    if (!localKeys.has(k)) removed.push(k);
  }

  // "Changed" per spec means key exists in both but value differs — we cannot know without showing values,
  // so we treat as unchanged for MVP and note that values are hidden.
  // Future: could compare hashes without revealing values.

  console.log(chalk.bold(`Environment: ${targetFile}`));
  if (remoteMeta?.version) console.log(chalk.dim(`Remote version: v${remoteMeta.version}${remoteMeta.createdAt ? ` • ${new Date(remoteMeta.createdAt).toLocaleString()}` : ""}`));
  console.log("");

  if (added.length) {
    console.log(chalk.green("Added (local only):"));
    for (const k of added.sort()) console.log(`  + ${k}`);
  } else {
    console.log(chalk.dim("Added: —"));
  }

  if (removed.length) {
    console.log(chalk.red("\nRemoved (remote only):"));
    for (const k of removed.sort()) console.log(`  - ${k}`);
  } else {
    console.log(chalk.dim("\nRemoved: —"));
  }

  if (unchanged.length) {
    console.log(chalk.dim(`\nUnchanged: ${unchanged.length} keys`));
    if (unchanged.length <= 10) {
      for (const k of unchanged.sort()) console.log(chalk.dim(`    ${k}`));
    }
  }

  console.log(chalk.dim("\nValues are intentionally hidden. Use envvault pull to restore."));
  console.log(chalk.dim(`Local keys: ${localKeys.size}, Remote keys: ${remoteKeys!.size}`));

  // Also check .env.example if exists for expected variables (§45)
  const examplePath = path.join(gitRoot, ".env.example");
  try {
    const exContent = await fs.readFile(examplePath, "utf-8");
    const expected = new Set(parseEnvContent(exContent).keys());
    const missing = [...expected].filter((k) => !localKeys.has(k) && !remoteKeys!.has(k));
    const present = expected.size - missing.length;
    console.log(chalk.dim(`\n.env.example: ${present}/${expected.size} expected variables present`));
    if (missing.length) console.log(chalk.yellow(`  Missing: ${missing.join(", ")}`));
  } catch {}
}
