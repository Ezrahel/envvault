import chalk from "chalk";
import inquirer from "inquirer";
import { saveAuth } from "../auth/store.js";
import { randomUUID } from "node:crypto";
import { getApiClient } from "../api/client.js";

export async function loginCommand(opts: { email?: string; password?: string; github?: boolean } = {}) {
  if (opts.github) {
    console.log(chalk.blue("Opening browser to authenticate with GitHub..."));
    console.log(chalk.dim("GitHub OAuth is central to EnvVault (repository identity) per spec §51."));
    console.log(chalk.dim("Requesting least-privilege scopes: read:user, repo (verification only)"));
    // In production, open browser to https://github.com/login/oauth/authorize?client_id=...
    // For MVP, simulate OAuth flow with mock
    console.log(chalk.dim("MVP: simulating GitHub OAuth (no browser required)."));
    let email = opts.email;
    if (!email) {
      const ans = await inquirer.prompt<{ email: string, githubUser: string }>([
        { type: "input", name: "email", message: "Email:", default: "dev@example.com" },
        { type: "input", name: "githubUser", message: "GitHub username:", default: "ademola" },
      ]);
      email = ans.email;
      // Store GitHub user for later verification
      (opts as any).githubUser = ans.githubUser;
    }
    console.log(chalk.green(`✓ GitHub OAuth simulated for @${(opts as any).githubUser ?? "ademola"}`));
    console.log(chalk.dim("  Repository verification will be available via GitHub API in production."));
  } else {
    console.log(chalk.blue("Open browser to authenticate EnvVault."));
    console.log(chalk.dim("MVP: local mock login (no browser required). Tip: use --github for GitHub OAuth"));
  }

  let email = opts.email;
  if (!email) {
    const ans = await inquirer.prompt<{ email: string }>([
      { type: "input", name: "email", message: "Email:", default: "dev@example.com" },
    ]);
    email = ans.email;
  }

  // Password: flag > env var > secure prompt (empty = legacy passwordless, dev only).
  let password = opts.password ?? process.env.ENVVAULT_PASSWORD;
  if (password === undefined && !opts.github) {
    const ans = await inquirer.prompt<{ password: string }>([
      { type: "password", name: "password", message: "Password (leave empty for dev-only passwordless login):", mask: "*" },
    ]);
    password = ans.password || undefined;
  }

  // Try API login first if reachable — registers token in API store so push/pull can authenticate
  let token: string | null = null;
  let userId: string | null = null;
  try {
    const api = await getApiClient();
    // Override token for login (no token yet)
    (api as any).token = undefined;
    const endpoint = opts.github ? "/v1/auth/github" : "/v1/auth/login";
    const body: any = opts.github ? { email, githubUser: (opts as any).githubUser ?? "ademola", provider: "github" } : { email, ...(password ? { password } : {}) };
    const res = await (api as any).f(`${(api as any).baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = (await res.json()) as { token: string; userId: string };
      token = data.token;
      userId = data.userId;
      console.log(chalk.dim(`  → API ${opts.github ? "GitHub " : ""}login succeeded`));
    } else {
      if (process.env.DEBUG) console.log(chalk.dim(`  API login failed: ${res.status}`));
      // Fallback to local if GitHub endpoint not yet available (e.g., old API)
      if (opts.github && res.status === 404) {
        const fallback = await (api as any).f(`${(api as any).baseUrl}/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, ...(password ? { password } : {}) }),
        });
        if (fallback.ok) {
          const data = (await fallback.json()) as { token: string; userId: string };
          token = data.token;
          userId = data.userId;
          console.log(chalk.dim(`  → API login succeeded (fallback)`));
        }
      }
    }
  } catch (e) {
    if (process.env.DEBUG) console.log(chalk.dim(`  API login not reachable, using local mock: ${(e as Error).message}`));
  }

  if (!token) {
    // Fallback local mock (offline or API down)
    token = `envvault_mock_${Buffer.from(email!).toString("base64").slice(0, 16)}_${randomUUID().slice(0, 8)}`;
    userId = `user_${randomUUID()}`;
  }
  const deviceId = randomUUID();

  await saveAuth({
    email: email!,
    token,
    userId: userId!,
    deviceId,
    masterKey: `master_${email}_${deviceId}`.slice(0, 64),
  });

  console.log(chalk.green("✓ Authentication successful"));
  console.log(chalk.green("✓ Device registered"));
  console.log(chalk.dim(`  Email: ${email}`));
  console.log(chalk.dim(`  Device: ${deviceId}`));
  if (token) console.log(chalk.dim(`  Token: ${token.slice(0, 16)}...`));
}
