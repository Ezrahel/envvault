import * as os from "node:os";
import { randomUUID } from "node:crypto";
import chalk from "chalk";
import { loadConfig } from "@envvault/config";
import { loadAuth, saveAuth, getAuthFilePath, type AuthState } from "./store.js";
import { deriveVaultKey, KEY_SCHEME } from "../crypto/vaultKey.js";

export class ApiUnreachableError extends Error {}

export async function apiBaseUrl(): Promise<string> {
  const cfg = await loadConfig();
  return (process.env.ENVVAULT_API_URL ?? cfg.apiUrl ?? "http://localhost:3001").replace(/\/+$/, "");
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  userId: string;
  email?: string;
  deviceId?: string;
}

/** POST an auth endpoint. Maps HTTP failures to clear, user-facing errors. */
export async function postAuth(path: string, body: Record<string, unknown>, messages: Partial<Record<number, string>> = {}): Promise<AuthResponse> {
  const base = await apiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, deviceName: os.hostname() || "unknown", platform: process.platform }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    throw new ApiUnreachableError(`EnvVault API unreachable at ${base} (${(e as Error).message})`);
  }
  if (res.ok) return (await res.json()) as AuthResponse;
  const serverMsg = await res
    .json()
    .then((j: any) => (typeof j?.error === "string" ? j.error : ""))
    .catch(() => "");
  if (messages[res.status]) throw new Error(messages[res.status]);
  if (res.status === 429) throw new Error("Too many attempts. Wait a minute and try again.");
  throw new Error(serverMsg || `Request failed (HTTP ${res.status})`);
}

/**
 * Persist the session + vault key. A previous, different key is kept as a
 * legacy decrypt-only key so older backups on this machine stay readable.
 */
export async function saveSession(params: {
  email: string;
  /** Derive the key from this passphrase… */
  passphrase?: string;
  /** …or keep an already-derived key (re-login to the same account). */
  masterKey?: string;
  auth: AuthResponse | null; // null = offline (API unreachable)
}): Promise<AuthState> {
  const email = params.email.trim().toLowerCase();
  const prev = await loadAuth();
  if (!params.masterKey && !params.passphrase) throw new Error("A vault passphrase is required.");
  const masterKey = params.masterKey ?? deriveVaultKey(params.passphrase!, email);
  const legacy = new Set(prev?.legacyMasterKeys ?? []);
  if (prev?.masterKey && prev.masterKey !== masterKey) legacy.add(prev.masterKey);
  legacy.delete(masterKey);

  const state: AuthState = {
    email,
    token: params.auth?.token ?? `offline_${randomUUID()}`,
    ...(params.auth?.refreshToken ? { refreshToken: params.auth.refreshToken } : {}),
    userId: params.auth?.userId ?? `offline_${randomUUID()}`,
    deviceId: params.auth?.deviceId ?? randomUUID(),
    masterKey,
    keyScheme: KEY_SCHEME,
    ...(legacy.size ? { legacyMasterKeys: [...legacy].slice(-5) } : {}),
    ...(params.auth ? {} : { offline: true }),
  };
  await saveAuth(state);
  return state;
}

/** The stored vault key, if re-logging into the same account on this machine (no passphrase re-prompt). */
export async function existingKeyFor(email: string): Promise<string | null> {
  const prev = await loadAuth();
  const same = !!prev?.masterKey && prev.keyScheme === KEY_SCHEME && prev.email === email.trim().toLowerCase();
  return same && !process.env.ENVVAULT_MASTER_KEY ? prev!.masterKey! : null;
}

export function printSession(state: AuthState, verb: string): void {
  if (state.offline) {
    console.log(chalk.yellow(`! Offline: ${verb} locally only. Backups stay in this machine's vault until you log in online.`));
  } else {
    console.log(chalk.green(`✓ ${verb}`));
    console.log(chalk.dim(`  Email:  ${state.email}`));
    console.log(chalk.dim(`  Device: ${os.hostname()} (${state.deviceId})`));
  }
  console.log(chalk.dim(`  Vault key stored at ${getAuthFilePath()} (mode 0600, never uploaded)`));
}
