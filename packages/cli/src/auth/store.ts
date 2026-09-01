import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { getConfigDir } from "@envvault/config";

// Fallback file store; on macOS/Windows we would use keychain – MVP uses file with 0600 + warning
export interface AuthState {
  token?: string;
  userId?: string;
  email?: string;
  deviceId?: string;
  masterKey?: string; // For MVP: derived encryption secret stored locally. In prod use keychain.
}

export function getAuthFilePath(): string {
  return path.join(getConfigDir(), "auth.json");
}

export async function loadAuth(): Promise<AuthState | null> {
  try {
    const raw = await fs.readFile(getAuthFilePath(), "utf-8");
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export async function saveAuth(state: AuthState): Promise<void> {
  const dir = getConfigDir();
  await fs.mkdir(dir, { recursive: true });
  const p = getAuthFilePath();
  await fs.writeFile(p, JSON.stringify(state, null, 2), { mode: 0o600, flag: "w" });
  try {
    await fs.chmod(p, 0o600);
  } catch {}
  if (state.masterKey) {
    console.warn("⚠ Master key stored in plaintext fallback file. Use OS keychain in production.");
  }
}

export async function clearAuth(): Promise<void> {
  try {
    await fs.unlink(getAuthFilePath());
  } catch {}
}

export async function requireAuth(): Promise<AuthState> {
  const a = await loadAuth();
  if (!a?.token) throw new Error("Not authenticated. Run: envvault login");
  return a;
}
