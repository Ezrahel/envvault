import chalk from "chalk";
import { initConfigIfNeeded, getConfigPath, loadConfig } from "@envvault/config";
import * as fs from "node:fs/promises";

export async function initCommand() {
  const cfgPath = await initConfigIfNeeded();
  const cfg = await loadConfig();
  console.log(chalk.green("✓ EnvVault initialized"));
  console.log(chalk.dim(`  Config: ${cfgPath}`));
  console.log(chalk.dim(`  API URL: ${cfg.apiUrl}`));
  console.log(chalk.dim(`  Scan roots: ${cfg.scan.roots.join(", ")}`));
  console.log("");
  console.log(chalk.blue("Next steps:"));
  console.log("  envvault login");
  console.log("  envvault scan");
  console.log("  envvault push");
}
