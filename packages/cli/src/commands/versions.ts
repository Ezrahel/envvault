import chalk from "chalk";
import * as path from "node:path";
import { findGitRoot, getOriginRemoteWithFallback, normalizeRemote } from "@envvault/git";
import { getApiClient } from "../api/client.js";
import * as fs from "node:fs/promises";

export interface VersionsOpts {
  path?: string;
  file?: string;
  json?: boolean;
}

export async function versionsCommand(opts: VersionsOpts = {}) {
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
  const fileName = opts.file ?? ".env";

  console.log(chalk.bold(`Version History`));
  console.log(chalk.dim(`Repository: ${canonical}`));
  console.log(chalk.dim(`File: ${fileName}`));
  console.log("");

  let versions: any[] = [];
  let source = "cloud";

  try {
    const api = await getApiClient();
    const list = await api.listVersions(canonical, fileName);
    if (list && list.length > 0) {
      versions = list;
      source = "cloud";
    }
  } catch (e) {
    if (process.env.DEBUG) console.log(chalk.dim(`API list failed: ${(e as Error).message}`));
  }

  if (versions.length === 0) {
    // Fallback to local vault — for MVP we store only latest, but we can list all if multiple .json version files exist
    // For now, local vault only has latest, so we show 1 version if file exists
    const { getConfigDir } = await import("@envvault/config");
    const vaultPath = path.join(getConfigDir(), "vault", canonical, `${fileName}.json`);
    try {
      const raw = await fs.readFile(vaultPath, "utf-8");
      const payload = JSON.parse(raw);
      versions = [
        {
          version: 1,
          id: "local",
          createdAt: (await fs.stat(vaultPath)).mtime.toISOString(),
          cipherAlgorithm: payload.algorithm ?? "AES-256-GCM",
          keyVersion: payload.keyVersion ?? 1,
        },
      ];
      source = "local vault";
    } catch {}
  }

  if (versions.length === 0) {
    console.log(chalk.yellow(`No versions found for ${fileName}.`));
    console.log(chalk.dim("Run envvault push first."));
    return;
  }

  if (opts.json) {
    console.log(JSON.stringify(versions, null, 2));
    return;
  }

  console.log(chalk.dim(`Source: ${source} • ${versions.length} version(s)`));
  console.log(chalk.dim("─".repeat(50)));
  console.log(`${"Version".padEnd(10)} ${"Created".padEnd(22)} ${"Cipher".padEnd(16)} ${"Key"}`);
  console.log(chalk.dim("─".repeat(50)));
  for (const v of [...versions].reverse()) {
    const ver = `v${v.version}`.padEnd(10);
    const when = (v.createdAt ? new Date(v.createdAt).toLocaleString() : "—").padEnd(22);
    const cipher = (v.cipherAlgorithm ?? v.algorithm ?? "AES-256-GCM").padEnd(16);
    const key = `v${v.keyVersion ?? 1}`;
    const latest = v.version === versions[versions.length - 1]?.version ? chalk.green(" ← latest") : "";
    console.log(`${chalk.bold(ver)} ${when} ${cipher} ${key}${latest}`);
  }
  console.log(chalk.dim("─".repeat(50)));
  console.log(chalk.dim(`Tip: envvault pull --at-version ${versions[versions.length - 1]?.version}  will restore that version`));
  console.log(chalk.dim(`Ciphertext never shown. Use pull to decrypt locally.`));
}
