import chalk from "chalk";
import { getApiClient } from "../api/client.js";
import { loadAuth } from "../auth/store.js";

export async function projectsCommand() {
  const auth = await loadAuth();
  if (!auth?.token) {
    console.log(chalk.yellow("Not authenticated. Run envvault login first."));
    console.log(chalk.dim("Showing local mock data:"));
  }

  try {
    const client = await getApiClient();
    const projects = await client.listProjects();
    if (projects.length === 0) {
      console.log(chalk.dim("No projects yet. Run envvault push to create one."));
      return;
    }
    console.log(chalk.bold("Projects:"));
    for (const p of projects) {
      console.log(`  ${chalk.green(p.canonicalRemote)}  ${chalk.dim(`(${p.id})`)}`);
    }
  } catch (e) {
    // Fallback to local scan + mock
    const msg = (e as Error).message;
    console.log(chalk.yellow(`Could not fetch from API: ${msg}`));
    console.log(chalk.dim("Run envvault scan to see local projects."));
  }
}
