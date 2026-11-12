import chalk from "chalk";
import inquirer from "inquirer";
import { ApiUnreachableError, existingKeyFor, postAuth, printSession, saveSession, type AuthResponse } from "../auth/session.js";
import { promptVaultPassphrase } from "../crypto/vaultKey.js";

export async function loginCommand(opts: { email?: string; password?: string; github?: boolean; githubUser?: string } = {}) {
  let email = opts.email;
  if (!email) {
    const ans = await inquirer.prompt<{ email: string }>([{ type: "input", name: "email", message: "Email:" }]);
    email = ans.email;
  }
  email = email.trim().toLowerCase();
  if (!email) throw new Error("Email is required.");

  let auth: AuthResponse | null = null;
  try {
    if (opts.github) {
      // GitHub OAuth (server must have GITHUB_CLIENT_ID/SECRET). In dev the API accepts a mock.
      auth = await postAuth(
        "/v1/auth/github",
        { email, githubUser: opts.githubUser ?? email.split("@")[0]!.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 39), provider: "github" },
        { 501: "GitHub login isn't enabled on this server yet. Use `envvault login` with email + password." },
      );
    } else {
      // Password: flag > ENVVAULT_PASSWORD > prompt. (Empty is only accepted by dev servers.)
      let password = opts.password ?? process.env.ENVVAULT_PASSWORD;
      if (password === undefined) {
        const ans = await inquirer.prompt<{ password: string }>([{ type: "password", name: "password", message: "Password:", mask: "*" }]);
        password = ans.password;
      }
      auth = await postAuth("/v1/auth/login", { email, ...(password ? { password } : {}) }, {
        401: "Invalid email or password. New to EnvVault? Run `envvault signup`.",
      });
    }
  } catch (e) {
    if (!(e instanceof ApiUnreachableError)) throw e;
    // Only an unreachable API falls back to offline mode — a rejected login never does.
    console.log(chalk.yellow(`! ${e.message}`));
    auth = null;
  }

  // Re-login to the same account keeps the existing vault key; otherwise ask for the passphrase.
  const kept = await existingKeyFor(email);
  const state = kept
    ? await saveSession({ email, masterKey: kept, auth })
    : await saveSession({ email, passphrase: await promptVaultPassphrase({ confirm: true, intro: true }), auth });
  printSession(state, "Logged in");
}
