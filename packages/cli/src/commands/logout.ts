import chalk from "chalk";
import { clearAuth, loadAuth } from "../auth/store.js";

export async function logoutCommand() {
  const auth = await loadAuth();
  if (!auth?.token) {
    console.log(chalk.yellow("Not logged in."));
    return;
  }
  await clearAuth();
  console.log(chalk.green("✓ Logged out"));
  console.log(chalk.dim("Local credentials cleared. Device revocation would happen server-side in production."));
}
