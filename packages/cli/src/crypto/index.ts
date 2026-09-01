export * from "@envvault/crypto";
import { createCryptoFromSecret, generateKey } from "@envvault/crypto";
import { loadAuth } from "../auth/store.js";

export async function getCryptoForCurrentUser() {
  const auth = await loadAuth();
  // For MVP, if no masterKey, derive from token or generate ephemeral
  const secret = auth?.masterKey ?? auth?.token ?? "envvault-dev-secret-please-change";
  return createCryptoFromSecret(secret);
}
