import chalk from "chalk";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { findGitRoot, getOriginRemoteWithFallback, normalizeRemote } from "@envvault/git";
import { getConfigDir, loadConfig, saveConfig } from "@envvault/config";
import inquirer from "inquirer";

export async function projectLinkCommand(opts: { to?: string; path?: string } = {}) {
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
  const current = normalizeRemote(remote);
  console.log(chalk.bold("Project Link — Handle remote changes (§13)"));
  console.log(chalk.dim(`Current remote: ${current.canonicalRemote}`));
  console.log(chalk.dim(`Git root: ${gitRoot}`));
  console.log("");

  if (!opts.to) {
    console.log(chalk.dim("This links the current remote to a previous canonical identity."));
    console.log(chalk.dim("Example: old github.com/<username>/<repository> → new github.com/company/<repository>"));
    const ans = await inquirer.prompt<{ to: string }>([
      { type: "input", name: "to", message: "Link to previous canonicalRemote (e.g., github.com/old/repo):" },
    ]);
    if (!ans.to) {
      console.log(chalk.yellow("Aborted."));
      return;
    }
    opts.to = ans.to;
  }

  const previous = opts.to!.trim();
  // Validate previous is a plausible canonical
  if (!previous.includes("/")) {
    console.error(chalk.red("Invalid canonicalRemote. Expected host/owner/repo"));
    process.exit(2);
  }

  const cfg = await loadConfig();
  const links = (cfg as any).projectLinks ?? {};
  links[current.canonicalRemote] = previous;
  (cfg as any).projectLinks = links;
  await saveConfig(cfg);

  console.log(chalk.green(`✓ Linked ${current.canonicalRemote} → ${previous}`));
  console.log(chalk.dim(`Saved to ${getConfigDir()}/config.json as projectLinks`));
  console.log(chalk.dim("Future pushes will be considered as same EnvVault project. Never auto-merge secrets (§13)."));
  console.log(chalk.dim(`To verify: cat ${getConfigDir()}/config.json`));
}
