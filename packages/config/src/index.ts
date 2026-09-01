import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

export interface EnvVaultConfig {
  scan: {
    roots: string[];
    ignoreDirs?: string[];
    followSymlinks?: boolean;
  };
  apiUrl?: string;
  logLevel?: string;
}

const DEFAULT_CONFIG: EnvVaultConfig = {
  scan: {
    roots: ["~/Projects", "~/Development", "~/Code", "~/Work"],
    followSymlinks: false,
  },
  apiUrl: process.env.ENVVAULT_API_URL ?? "https://api.envvault.dev",
  logLevel: process.env.ENVVAULT_LOG_LEVEL ?? "info",
};

export function getConfigDir(): string {
  if (process.env.ENVVAULT_CONFIG_DIR) return path.resolve(process.env.ENVVAULT_CONFIG_DIR);
  const platform = process.platform;
  if (platform === "win32") {
    const base = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
    return path.join(base, "EnvVault");
  }
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "EnvVault");
  }
  // linux
  return path.join(os.homedir(), ".config", "envvault");
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), "config.json");
}

export function getAuthPath(): string {
  return path.join(getConfigDir(), "auth.json");
}

export async function loadConfig(): Promise<EnvVaultConfig> {
  const p = getConfigPath();
  try {
    const raw = await fs.readFile(p, "utf-8");
    const parsed = JSON.parse(raw) as Partial<EnvVaultConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      scan: { ...DEFAULT_CONFIG.scan, ...(parsed.scan ?? {}) },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(cfg: EnvVaultConfig): Promise<void> {
  const dir = getConfigDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(getConfigPath(), JSON.stringify(cfg, null, 2), "utf-8");
}

export async function initConfigIfNeeded(): Promise<string> {
  const p = getConfigPath();
  try {
    await fs.access(p);
    return p;
  } catch {
    await saveConfig(DEFAULT_CONFIG);
    return p;
  }
}
