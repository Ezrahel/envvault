export * from "@envvault/crypto";
import { createCryptoFromSecret, type CryptoProvider } from "@envvault/crypto";
import { loadAuth } from "../auth/store.js";
import { deriveVaultKey } from "./vaultKey.js";

export const WRONG_KEY_HINT =
  "wrong vault passphrase, or this backup was sealed with a different one. Run `envvault login` and re-enter your vault passphrase.";

/**
 * Crypto for the logged-in user.
 * Encrypts with the current vault key. Decrypts with the current key, then
 * falls back to keys from earlier logins on this machine (so backups made
 * before the passphrase scheme still restore where they were created).
 */
export async function getCryptoForCurrentUser(): Promise<CryptoProvider> {
  const auth = await loadAuth();
  let primary = auth?.masterKey;
  // CI / scripts: ENVVAULT_MASTER_KEY overrides the stored key (it is the passphrase).
  const envPass = process.env.ENVVAULT_MASTER_KEY;
  if (envPass && auth?.email) primary = deriveVaultKey(envPass, auth.email);
  if (!primary) {
    throw new Error("No vault key on this machine. Run `envvault login` (or `envvault signup`) first.");
  }
  const current = createCryptoFromSecret(primary);
  const legacy = (auth?.legacyMasterKeys ?? []).filter((k) => k && k !== primary).map((k) => createCryptoFromSecret(k));

  return {
    encrypt: (plaintext, aad) => current.encrypt(plaintext, aad),
    async decrypt(payload, aad) {
      try {
        return await current.decrypt(payload, aad);
      } catch (first) {
        for (const p of legacy) {
          try {
            return await p.decrypt(payload, aad);
          } catch {}
        }
        if (/auth(entication)? tag|Decryption failed/i.test((first as Error).message)) {
          throw new Error(`Decryption failed: ${WRONG_KEY_HINT}`);
        }
        throw first;
      }
    },
  };
}
