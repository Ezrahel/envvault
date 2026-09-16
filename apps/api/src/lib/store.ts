import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as dbStore from "./db-store.js";

/**
 * Store facade: CockroachDB (via Drizzle) when configured, in-memory Maps otherwise.
 * - DB mode: DATABASE_URL set, migrations applied at boot (see initStore).
 *   Survives restarts and scales beyond one node. Legacy opaque tokens stay
 *   in-memory (JWT is the primary mechanism; old CLIs re-login after deploy).
 * - Memory mode (dev/test/no DATABASE_URL): previous behavior + crash-safe
 *   disk snapshot. Tests (VITEST) always use memory for determinism.
 * Routes call this facade and never care which backend is active.
 */

export interface UserRecord {
  id: string;
  email: string;
  name?: string | undefined;
  avatarUrl?: string | undefined;
  /** scrypt hash (`scrypt$...`). Absent for legacy email-only accounts. */
  passwordHash?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord {
  id: string;
  userId: string;
  provider: string;
  host: string;
  owner?: string | undefined;
  repository: string;
  canonicalRemote: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentRecord {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | undefined;
}

export interface EnvFileRecord {
  id: string;
  environmentId: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecretVersionRecord {
  id: string;
  version: number;
  environmentFileId: string;
  objectKey: string;
  cipherAlgorithm: string;
  algorithm?: string | undefined; // alias for cipherAlgorithm for EncryptedPayload compat
  formatVersion?: number | undefined;
  keyVersion: number;
  nonce: string;
  authTag?: string | undefined;
  ciphertext?: string | undefined; // for in-memory; prod stores only metadata + object storage
  createdAt: string;
  createdBy?: string | undefined;
  canonicalRemote: string;
  fileName: string;
  environmentName: string;
}

export interface DeviceRecord {
  id: string;
  userId: string;
  name: string;
  platform?: string | undefined;
  lastSeenAt: string;
  createdAt: string;
  revokedAt?: string | null;
}

// In-memory stores
const users = new Map<string, UserRecord>(); // id -> user
const usersByEmail = new Map<string, string>(); // email -> id
const tokens = new Map<string, string>(); // token -> userId
const projects = new Map<string, ProjectRecord>(); // key userId:canonical -> project OR id -> project
const projectsById = new Map<string, ProjectRecord>();
const environments = new Map<string, EnvironmentRecord>();
const envFiles = new Map<string, EnvFileRecord>();
const secretVersions = new Map<string, SecretVersionRecord[]>(); // key canonical:fileName -> versions
const devices = new Map<string, DeviceRecord>();
const auditLogs: Array<{ id: string; userId?: string | undefined; projectId?: string | undefined; action: string; deviceId?: string | undefined; ipHash?: string | undefined; createdAt: string }> = [];
// Revoked JWT ids (logout / refresh rotation). Persisted in snapshot; use Redis/DB when multi-node.
const revokedJtis = new Set<string>();

// ─── Backend selection ───
let dbMode = false;

/** True once initStore() has successfully switched to CockroachDB. */
export function isDbMode(): boolean {
  return dbMode;
}

/** Test-only: force the facade into DB mode (pair with __setDbOverride). */
export function __setDbMode(v: boolean): void {
  dbMode = v;
}

/**
 * Boot the store. With DATABASE_URL (and not under vitest): run migrations,
 * verify connectivity, and switch to the DB backend. In production a failure
 * here is fatal (loud > silently running on ephemeral memory); in dev we warn
 * and fall back to memory + snapshot so `pnpm dev` works without a database.
 */
export async function initStore(): Promise<"db" | "memory"> {
  const url = process.env.DATABASE_URL;
  if (!url || process.env.VITEST) {
    await loadSnapshot();
    return "memory";
  }
  try {
    const { runMigrations } = await import("./migrate.js");
    await runMigrations(url);
    const { checkDbHealth } = await import("./db.js");
    const health = await checkDbHealth();
    if (!health.ok) throw new Error(health.error ?? "unknown database error");
    dbMode = true;
    console.log("[store] backend: CockroachDB/Postgres via Drizzle");
    return "db";
  } catch (e) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Database init failed in production: ${(e as Error).message}`);
    }
    console.warn(`[store] database unavailable (${(e as Error).message}) — using in-memory + snapshot`);
    await loadSnapshot();
    return "memory";
  }
}

// ─── Crash-safe disk snapshot (single-node MVP) ───
// In-memory Maps lose everything on restart. Until the store is fully
// Drizzle-backed, we snapshot to disk (atomic write+rename) so a redeploy
// or crash doesn't wipe users/projects/versions. Mount `data/` as a volume.
// Disabled under vitest and when STORE_SNAPSHOT_DISABLED=1.
function snapshotPath(): string | null {
  if (process.env.STORE_SNAPSHOT_DISABLED === "1" || process.env.VITEST) return null;
  return process.env.STORE_SNAPSHOT_PATH ?? path.join(process.cwd(), "data", "api-store.json");
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveInFlight = false;
let saveQueued = false;

function scheduleSnapshotSave(): void {
  if (dbMode) return; // DB is the source of truth — no snapshot needed
  if (!snapshotPath()) return;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void flushSnapshot();
  }, 500);
  // Allow process to exit without waiting for the debounce
  (saveTimer as any)?.unref?.();
}

export async function flushSnapshot(): Promise<void> {
  if (dbMode) return;
  const file = snapshotPath();
  if (!file) return;
  if (saveInFlight) {
    saveQueued = true;
    return;
  }
  saveInFlight = true;
  try {
    const payload = JSON.stringify(
      {
        version: 1,
        savedAt: new Date().toISOString(),
        users: [...users.values()],
        usersByEmail: [...usersByEmail.entries()],
        legacyTokens: [...tokens.entries()],
        revokedJtis: [...revokedJtis],
        projects: [...projects.entries()],
        projectsById: [...projectsById.entries()],
        environments: [...environments.entries()],
        envFiles: [...envFiles.entries()],
        secretVersions: [...secretVersions.entries()],
        devices: [...devices.entries()],
        auditLogs,
      },
      null,
      0
    );
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, payload, { mode: 0o600 });
    await fs.rename(tmp, file);
  } catch (e) {
    console.warn("[store] snapshot save failed:", (e as Error).message);
  } finally {
    saveInFlight = false;
    if (saveQueued) {
      saveQueued = false;
      scheduleSnapshotSave();
    }
  }
}

export async function loadSnapshot(): Promise<boolean> {
  if (dbMode) return false;
  const file = snapshotPath();
  if (!file) return false;
  try {
    const raw = await fs.readFile(file, "utf-8");
    const s = JSON.parse(raw) as any;
    if (!s || s.version !== 1) return false;
    users.clear();
    for (const u of s.users ?? []) users.set(u.id, u);
    usersByEmail.clear();
    for (const [k, v] of s.usersByEmail ?? []) usersByEmail.set(k, v);
    tokens.clear();
    for (const [k, v] of s.legacyTokens ?? []) tokens.set(k, v);
    revokedJtis.clear();
    for (const j of s.revokedJtis ?? []) revokedJtis.add(j);
    projects.clear();
    for (const [k, v] of s.projects ?? []) projects.set(k, v);
    projectsById.clear();
    for (const [k, v] of s.projectsById ?? []) projectsById.set(k, v);
    environments.clear();
    for (const [k, v] of s.environments ?? []) environments.set(k, v);
    envFiles.clear();
    for (const [k, v] of s.envFiles ?? []) envFiles.set(k, v);
    secretVersions.clear();
    for (const [k, v] of s.secretVersions ?? []) secretVersions.set(k, v);
    devices.clear();
    for (const [k, v] of s.devices ?? []) devices.set(k, v);
    auditLogs.length = 0;
    for (const l of s.auditLogs ?? []) auditLogs.push(l);
    console.log(`[store] loaded snapshot (${s.users?.length ?? 0} users, ${s.projectsById?.length ?? 0} projects)`);
    return true;
  } catch (e: any) {
    if (e?.code !== "ENOENT") console.warn("[store] snapshot load failed:", e.message);
    return false;
  }
}

export const store = {
  // Users
  /** Ensure a user exists (no token issued). New auth routes use this + signed JWT. */
  async ensureUser(email: string, name?: string): Promise<UserRecord> {
    if (dbMode) return dbStore.dbEnsureUser(email, name);
    let userId = usersByEmail.get(email);
    let user = userId ? users.get(userId) : undefined;
    if (!user) {
      userId = `user_${email}`;
      user = {
        id: userId,
        email,
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      users.set(userId, user);
      usersByEmail.set(email, userId);
      scheduleSnapshotSave();
    } else if (name && !user.name) {
      user.name = name;
      user.updatedAt = new Date().toISOString();
      scheduleSnapshotSave();
    }
    return user;
  },

  async upsertUser(email: string): Promise<{ user: UserRecord; token: string }> {
    const user = await this.ensureUser(email);
    // Legacy opaque token (kept for backward compat with older CLI builds).
    // In-memory in both modes; new clients receive signed JWTs instead.
    const token = `envvault_mock_${Buffer.from(email).toString("base64").slice(0, 16)}_${randomUUID().slice(0, 8)}`;
    tokens.set(token, user.id);
    scheduleSnapshotSave();
    return { user, token };
  },

  async getUserByToken(token: string): Promise<UserRecord | null> {
    const userId = tokens.get(token);
    if (!userId) return null;
    return users.get(userId) ?? null;
  },

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    if (dbMode) return dbStore.dbGetUserByEmail(email);
    const id = usersByEmail.get(email);
    if (!id) return null;
    return users.get(id) ?? null;
  },

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    if (dbMode) return dbStore.dbSetPasswordHash(userId, passwordHash);
    const u = users.get(userId);
    if (!u) throw new Error("User not found");
    u.passwordHash = passwordHash;
    u.updatedAt = new Date().toISOString();
    scheduleSnapshotSave();
  },

  async revokeJti(jti: string): Promise<void> {
    if (dbMode) return dbStore.dbRevokeJti(jti);
    revokedJtis.add(jti);
    scheduleSnapshotSave();
  },

  async isJtiRevoked(jti: string): Promise<boolean> {
    if (dbMode) return dbStore.dbIsJtiRevoked(jti);
    return revokedJtis.has(jti);
  },

  async revokeToken(token: string): Promise<void> {
    tokens.delete(token);
    scheduleSnapshotSave();
  },

  async rotateToken(oldToken: string): Promise<string | null> {
    const userId = tokens.get(oldToken);
    if (!userId) return null;
    tokens.delete(oldToken);
    const newToken = `envvault_mock_${randomUUID().slice(0, 16)}`;
    tokens.set(newToken, userId);
    scheduleSnapshotSave();
    return newToken;
  },

  // Projects
  async listProjects(userId: string): Promise<ProjectRecord[]> {
    if (dbMode) return dbStore.dbListProjects(userId);
    return [...projectsById.values()].filter((p) => p.userId === userId);
  },

  async findProjectByCanonical(userId: string, canonical: string): Promise<ProjectRecord | null> {
    if (dbMode) return dbStore.dbFindProjectByCanonical(userId, canonical);
    const key = `${userId}:${canonical}`;
    return projects.get(key) ?? null;
  },

  async createProject(data: Omit<ProjectRecord, "id" | "createdAt" | "updatedAt">): Promise<ProjectRecord> {
    if (dbMode) return dbStore.dbCreateProject(data);
    const key = `${data.userId}:${data.canonicalRemote}`;
    const existing = projects.get(key);
    if (existing) return existing;
    const rec: ProjectRecord = {
      id: randomUUID(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    projects.set(key, rec);
    projectsById.set(rec.id, rec);
    scheduleSnapshotSave();
    return rec;
  },

  async getProjectById(userId: string, id: string): Promise<ProjectRecord | null> {
    if (dbMode) return dbStore.dbGetProjectById(userId, id);
    const p = projectsById.get(id);
    if (!p || p.userId !== userId) return null;
    return p;
  },

  async deleteProject(userId: string, id: string): Promise<boolean> {
    if (dbMode) return dbStore.dbDeleteProject(userId, id);
    const p = projectsById.get(id);
    if (!p || p.userId !== userId) return false;
    const key = `${userId}:${p.canonicalRemote}`;
    projects.delete(key);
    projectsById.delete(id);
    scheduleSnapshotSave();
    return true;
  },

  // Environments
  async listEnvironments(projectId: string): Promise<EnvironmentRecord[]> {
    if (dbMode) return dbStore.dbListEnvironments(projectId);
    return [...environments.values()].filter((e) => e.projectId === projectId);
  },

  async createEnvironment(projectId: string, name: string, createdBy?: string | undefined): Promise<EnvironmentRecord> {
    if (dbMode) return dbStore.dbCreateEnvironment(projectId, name, createdBy);
    const existing = [...environments.values()].find((e) => e.projectId === projectId && e.name === name);
    if (existing) return existing;
    const rec: EnvironmentRecord = {
      id: randomUUID(),
      projectId,
      name,
      createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    environments.set(rec.id, rec);
    scheduleSnapshotSave();
    return rec;
  },

  async getEnvironment(id: string): Promise<EnvironmentRecord | null> {
    if (dbMode) return dbStore.dbGetEnvironment(id);
    return environments.get(id) ?? null;
  },

  // Env Files
  async listEnvFiles(environmentId: string): Promise<EnvFileRecord[]> {
    if (dbMode) return dbStore.dbListEnvFiles(environmentId);
    return [...envFiles.values()].filter((f) => f.environmentId === environmentId);
  },

  async createEnvFile(environmentId: string, fileName: string): Promise<EnvFileRecord> {
    if (dbMode) return dbStore.dbCreateEnvFile(environmentId, fileName);
    const existing = [...envFiles.values()].find((f) => f.environmentId === environmentId && f.fileName === fileName);
    if (existing) return existing;
    const rec: EnvFileRecord = {
      id: randomUUID(),
      environmentId,
      fileName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    envFiles.set(rec.id, rec);
    scheduleSnapshotSave();
    return rec;
  },

  // Secret Versions
  async addVersion(v: Omit<SecretVersionRecord, "id" | "version" | "createdAt">): Promise<SecretVersionRecord> {
    if (dbMode) return dbStore.dbAddVersion(v);
    const key = `${v.canonicalRemote}:${v.fileName}`;
    const list = secretVersions.get(key) ?? [];
    const version = list.length + 1;
    const rec: SecretVersionRecord = {
      id: randomUUID(),
      version,
      ...v,
      createdAt: new Date().toISOString(),
    };
    list.push(rec);
    secretVersions.set(key, list);
    scheduleSnapshotSave();
    return rec;
  },

  async listVersions(canonical: string, fileName: string): Promise<SecretVersionRecord[]> {
    if (dbMode) return dbStore.dbListVersions(canonical, fileName);
    return secretVersions.get(`${canonical}:${fileName}`) ?? [];
  },

  async getVersionByNumber(canonical: string, fileName: string, version: number): Promise<SecretVersionRecord | null> {
    if (dbMode) return dbStore.dbGetVersionByNumber(canonical, fileName, version);
    const list = secretVersions.get(`${canonical}:${fileName}`) ?? [];
    return list.find((v) => v.version === version) ?? null;
  },

  // Devices
  async registerDevice(userId: string, name: string, platform?: string | undefined): Promise<DeviceRecord> {
    if (dbMode) return dbStore.dbRegisterDevice(userId, name, platform);
    const rec: DeviceRecord = {
      id: randomUUID(),
      userId,
      name,
      platform,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      revokedAt: null,
    };
    devices.set(rec.id, rec);
    scheduleSnapshotSave();
    return rec;
  },

  async listDevices(userId: string): Promise<DeviceRecord[]> {
    if (dbMode) return dbStore.dbListDevices(userId);
    return [...devices.values()].filter((d) => d.userId === userId && !d.revokedAt);
  },

  async revokeDevice(deviceId: string): Promise<void> {
    if (dbMode) return dbStore.dbRevokeDevice(deviceId);
    const d = devices.get(deviceId);
    if (d) {
      d.revokedAt = new Date().toISOString();
      scheduleSnapshotSave();
    }
  },

  // Audit
  async audit(entry: { userId?: string | undefined; projectId?: string | undefined; action: string; deviceId?: string | undefined; ipHash?: string | undefined }): Promise<void> {
    if (dbMode) return dbStore.dbAudit(entry);
    auditLogs.push({
      id: randomUUID(),
      ...entry,
      createdAt: new Date().toISOString(),
    });
    // Never log secret values — entry is metadata only
    // Audit writes are frequent; snapshot is debounced so this is cheap.
    scheduleSnapshotSave();
  },

  async listAuditLogs(userId?: string): Promise<typeof auditLogs> {
    if (dbMode) return dbStore.dbListAuditLogs(userId) as Promise<typeof auditLogs>;
    if (!userId) return auditLogs;
    return auditLogs.filter((l) => l.userId === userId);
  },

  // Testing helper
  _clearAll(): void {
    users.clear();
    usersByEmail.clear();
    tokens.clear();
    revokedJtis.clear();
    projects.clear();
    projectsById.clear();
    environments.clear();
    envFiles.clear();
    secretVersions.clear();
    devices.clear();
    auditLogs.length = 0;
  },
};
