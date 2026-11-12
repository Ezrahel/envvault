import chalk from "chalk";
import inquirer from "inquirer";
import { ApiUnreachableError, postAuth, printSession, saveSession } from "../auth/session.js";
import { promptVaultPassphrase } from "../crypto/vaultKey.js";

/**
 * Create an account, register this device, and set the vault passphrase.
 * Two secrets, on purpose:
 *  - account password → authenticates you to the EnvVault API
 *  - vault passphrase → encrypts your .env files locally; the server never sees it
 */
export async function signupCommand(opts: { email?: string; password?: string } = {}) {
  let email = opts.email;
  if (!email) {
    const ans = await inquirer.prompt<{ email: string }>([{ type: "input", name: "email", message: "Email:" }]);
    email = ans.email;
  }
  email = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");

  let password = opts.password ?? process.env.ENVVAULT_PASSWORD;
  if (password === undefined) {
    for (;;) {
      const { p1 } = await inquirer.prompt<{ p1: string }>([{ type: "password", name: "p1", message: "Account password (8+ chars):", mask: "*" }]);
      if (p1.length < 8) {
        console.log("  Must be at least 8 characters.");
        continue;
      }
      const { p2 } = await inquirer.prompt<{ p2: string }>([{ type: "password", name: "p2", message: "Confirm account password:", mask: "*" }]);
      if (p1 === p2) {
        password = p1;
        break;
      }
      console.log("  Passwords didn't match. Try again.");
    }
  }
  if (password.length < 8) throw new Error("Account password must be at least 8 characters.");

  // Ask for the vault passphrase *before* creating the account, so a cancelled
  // prompt doesn't leave a half-set-up account behind.
  const passphrase = await promptVaultPassphrase({ confirm: true, intro: true });

  let auth;
  try {
    auth = await postAuth("/v1/auth/register", { email, password }, {
      409: "An account with this email already exists. Run `envvault login` instead.",
    });
  } catch (e) {
    if (e instanceof ApiUnreachableError) throw new Error(`${e.message}. Sign-up needs the API; check your connection or ENVVAULT_API_URL.`);
    throw e;
  }

  const state = await saveSession({ email, passphrase, auth });
  printSession(state, "Account created");
  console.log("");
  console.log(chalk.bold("Next:"));
  console.log(`  ${chalk.cyan("envvault push")}   back up this repo's .env files`);
  console.log(`  ${chalk.cyan("envvault backup")} back up every repo under your configured roots`);
  console.log(chalk.dim("  On a new machine: envvault login → git clone → envvault pull"));
}
