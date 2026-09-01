import chalk from "chalk";
import * as path from "node:path";
import { scanRoots } from "@envvault/env-parser";
import { loadConfig } from "@envvault/config";

export interface ScanOpts {
  path?: string;
  roots?: string[];
  followSymlinks?: boolean;
  json?: boolean;
}

export async function scanCommand(opts: ScanOpts = {}) {
  const cfg = await loadConfig();
  const roots = opts.path ? [opts.path] : opts.roots ?? cfg.scan.roots;
  const expanded = roots.map((r) => r.replace(/^~(?=$|\/|\\)/, process.env.HOME ?? "")).map((r) => path.resolve(r));

  console.log(chalk.dim(`Scanning configured directories...`));
  console.log(chalk.dim(`Roots: ${expanded.join(", ")}`));
  console.log("");

  let countFiles = 0;
  let countRepos = 0;
  const repoSet = new Set<string>();
  const results: Array<{ path: string; git: string | null }> = [];
  let skippedPermission = 0;

  const start = Date.now();

  for await (const found of scanRoots(expanded, {
    followSymlinks: opts.followSymlinks ?? cfg.scan.followSymlinks,
    ignoreDirs: cfg.scan.ignoreDirs,
  })) {
    countFiles++;
    const git = found.project?.canonicalRemote ?? found.gitRoot ?? null;
    if (git) repoSet.add(git);
    results.push({ path: found.absolutePath, git });

    if (!opts.json) {
      console.log(chalk.green(`✓ ${found.absolutePath}`));
      if (found.project) {
        console.log(chalk.dim(`  Git: ${found.project.canonicalRemote}`));
      } else if (found.gitRoot) {
        console.log(chalk.yellow(`  Git root: ${found.gitRoot} (no remote)`));
      } else {
        console.log(chalk.yellow(`  Git: not a git repository`));
      }
    }
  }

  countRepos = repoSet.size;

  if (opts.json) {
    console.log(JSON.stringify({ files: results, repos: [...repoSet], countFiles, countRepos }, null, 2));
    return;
  }

  console.log("");
  console.log(chalk.bold(`${countRepos} repositories`));
  console.log(chalk.bold(`${countFiles} environment files`));

  // Handle duplicates: same canonicalRemote with multiple paths
  const byRepo = new Map<string, string[]>();
  for (const r of results) {
    if (!r.git) continue;
    const arr = byRepo.get(r.git) ?? [];
    arr.push(r.path);
    byRepo.set(r.git, arr);
  }
  for (const [repo, paths] of byRepo) {
    if (paths.length > 1) {
      console.log("");
      console.log(chalk.yellow(`Repository:`));
      console.log(chalk.yellow(`  ${repo}`));
      console.log(chalk.yellow(`Found:`));
      for (const p of paths) console.log(chalk.yellow(`  ${p}`));
      console.log(chalk.dim(`  → Use envvault push to choose which environment to backup.`));
    }
  }

  const elapsed = Date.now() - start;
  console.log(chalk.dim(`\nScan completed in ${elapsed}ms`));
}
