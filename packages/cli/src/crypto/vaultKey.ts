import { scryptSync } from "node:crypto";
import inquirer from "inquirer";

/**
 * Vault key = scrypt(passphrase, "envvault-vault-v1:" + email).
 *
 * The same passphrase + account email yields the same key on every machine,
 * which is what makes "clone → envvault pull" work on a new laptop. The
 * passphrase and key never leave the device; the server only ever sees
 * ciphertext. Losing the passphrase means the backups are unrecoverable.
 */
export const KEY_SCHEME = "passphrase-v1";
export const MIN_PASSPHRASE = 8;

export function deriveVaultKey(passphrase: string, email: string): string {
  const salt = `envvault-vault-v1:${email.trim().toLowerCase()}`;
  // N=2^15 ≈ 100 ms on a laptop; maxmem must exceed 128·N·r (32 MiB).
  return scryptSync(passphrase.normalize("NFKC"), salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex");
}

/**
 * Get the vault passphrase: ENVVAULT_MASTER_KEY (CI / scripts) or an interactive prompt.
 * `confirm` asks twice so a typo can't silently become the key backups are sealed with.
 */
export async function promptVaultPassphrase(opts: { confirm: boolean; intro?: boolean }): Promise<string> {
  const fromEnv = process.env.ENVVAULT_MASTER_KEY;
  if (fromEnv !== undefined && fromEnv !== "") {
    if (fromEnv.length < MIN_PASSPHRASE) throw new Error(`ENVVAULT_MASTER_KEY must be at least ${MIN_PASSPHRASE} characters.`);
    return fromEnv;
  }
  if (!process.stdin.isTTY) {
    throw new Error("No terminal to prompt for your vault passphrase. Set ENVVAULT_MASTER_KEY.");
  }
  if (opts.intro) {
    console.log("");
    console.log("Your vault passphrase encrypts your .env files on this machine. It is never sent to EnvVault.");
    console.log("Use the same one on every machine. If you lose it, your backups cannot be recovered.");
  }
  for (;;) {
    const { pass } = await inquirer.prompt<{ pass: string }>([
      { type: "password", name: "pass", message: "Vault passphrase:", mask: "*" },
    ]);
    if (pass.length < MIN_PASSPHRASE) {
      console.log(`  Must be at least ${MIN_PASSPHRASE} characters.`);
      continue;
    }
    if (!opts.confirm) return pass;
    const { again } = await inquirer.prompt<{ again: string }>([
      { type: "password", name: "again", message: "Confirm vault passphrase:", mask: "*" },
    ]);
    if (again === pass) {
      if (pass.length < 12) console.log("  Tip: 12+ characters (or a few random words) is much harder to guess.");
      return pass;
    }
    console.log("  Passphrases didn't match. Try again.");
  }
}
