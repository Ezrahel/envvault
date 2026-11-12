import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as dbStore from "./db-store.js";

/**
 * Store facade: CockroachDB/Postgres (via Drizzle) when configured, in-memory
 * Maps otherwise. Routes call this facade and never care which backend is active.
 *
 * TENANCY INVARIANT: every project-scoped read/write takes the authenticated
 * userId and resolves the project by (userId, canonicalRemote) or
 * (userId, projectId). Nothing is ever looked up by canonicalRemote alone —
 * two accounts pushing the same remote get fully separate histories.
 *
 * - DB mode: DATABASE_URL set, migrations applied at boot (see initStore).
 * - Memory mode (dev/test/no DATABASE_URL): crash-safe disk snapshot.
 *   Tests (VITEST) always use memory unless a test forces DB mode.
 */

export interface UserRecord {
  id: string;
  email: string;
  name?: string | undefined;
  avatarUrl?: string | undefined;
  /** scrypt hash (`scrypt$...`). Absent for passwordless (e.g. GitHub) accounts. */
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
  algorithm?: string | undefined;
  formatVersion?: number | undefined;
  keyVersion: number;
  nonce: string;
  authTag?: string | undefined;
  /** Encrypted blob only — never plaintext. */
  ciphertext?: string | undefined;
  createdAt: string;
  createdBy?: string | undefined;
  canonicalRemote: string;
  fileName: string;
  environmentName: string;
}

export interface NewVersionInput {
  /** Pre-generated so the object-storage write can happen before the row insert. */
  id: string;
  userId: string;
  projectId: string;
  environmentName: string;
  fileName: string;
  objectKey: string;
  cipherAlgorithm: string;
  formatVersion: number;
  keyVersion: number;
  nonce: string;
  authTag?: string | undefined;
  ciphertext: string;
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

type AuditEntry = {
  id: string;
  userId?: string | undefined;
  projectId?: string | undefined;
  action: string;
  deviceId?: string | undefined;
  ipHash?: string | undefined;
  createdAt: string;
};

// ─── In-memory backend ───
const users = new Map<string, UserRecord>(); // id -> user
const usersByEmail = new Map<string, string>(); // normalized email -> id
const projectsById = new Map<string, ProjectRecord>();
const projectsByKey = new Map<string, string>(); // `${userId}:${canonical}` -> projectId
const environments = new Map<string, EnvironmentRecord>();
const envFiles = new Map<string, EnvFileRecord>();
const secretVersions = new Map<string, SecretVersionRecord[]>(); // `${projectId}:${fileName}` -> versions (asc)
const devices = new Map<string, DeviceRecord>();
const auditLogs: AuditEntry[] = [];
const revokedJtis = new Map<string, number>(); // jti -> expiresAt (ms)

const now = () => new Date().toISOString();
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// ─── Backend selection ───
let dbMode = false;

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
 * here is fatal; in dev we warn and fall back to memory + snapshot.
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

// ─── Crash-safe disk snapshot (memory mode only) ───
const SNAPSHOT_VERSION = 2;

function snapshotPath(): string | null {
  if (process.env.STORE_SNAPSHOT_DISABLED === "1" || process.env.VITEST) return null;
  return process.env.STORE_SNAPSHOT_PATH ?? path.join(process.cwd(), "data", "api-store.json");
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveInFlight = false;
let saveQueued = false;

function scheduleSnapshotSave(): void {
  if (dbMode || !snapshotPath() || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void flushSnapshot();
  }, 500);
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
    const payload = JSON.stringify({
      version: SNAPSHOT_VERSION,
      savedAt: now(),
      users: [...users.values()],
      revokedJtis: [...revokedJtis.entries()],
      projects: [...projectsById.values()],
      environments: [...environments.values()],
      envFiles: [...envFiles.values()],
      secretVersions: [...secretVersions.entries()],
      devices: [...devices.values()],
      auditLogs: auditLogs.slice(-10_000),
    });
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
    const s = JSON.parse(await fs.readFile(file, "utf-8")) as any;
    if (!s || s.version !== SNAPSHOT_VERSION) {
      if (s?.version) console.warn(`[store] ignoring snapshot v${s.version} (expected v${SNAPSHOT_VERSION}) — legacy layout was not tenant-isolated`);
      return false;
    }
    store._clearAll();
    for (const u of s.users ?? []) {
      users.set(u.id, u);
      usersByEmail.set(normalizeEmail(u.email), u.id);
    }
    for (const [k, v] of s.revokedJtis ?? []) revokedJtis.set(k, v);
    for (const p of s.projects ?? []) {
      projectsById.set(p.id, p);
      projectsByKey.set(`${p.userId}:${p.canonicalRemote}`, p.id);
    }
    for (const e of s.environments ?? []) environments.set(e.id, e);
    for (const f of s.envFiles ?? []) envFiles.set(f.id, f);
    for (const [k, v] of s.secretVersions ?? []) secretVersions.set(k, v);
    for (const d of s.devices ?? []) devices.set(d.id, d);
    for (const l of s.auditLogs ?? []) auditLogs.push(l);
    console.log(`[store] loaded snapshot (${users.size} users, ${projectsById.size} projects)`);
    return true;
  } catch (e: any) {
    if (e?.code !== "ENOENT") console.warn("[store] snapshot load failed:", e.message);
    return false;
  }
}

// ─── Memory helpers ───
function memEnsureEnvironment(projectId: string, name: string, createdBy?: string): EnvironmentRecord {
  const existing = [...environments.values()].find((e) => e.projectId === projectId && e.name === name);
  if (existing) return existing;
  const rec: EnvironmentRecord = { id: randomUUID(), projectId, name, createdBy, createdAt: now(), updatedAt: now() };
  environments.set(rec.id, rec);
  return rec;
}

function memEnsureEnvFile(environmentId: string, fileName: string): EnvFileRecord {
  const existing = [...envFiles.values()].find((f) => f.environmentId === environmentId && f.fileName === fileName);
  if (existing) return existing;
  const rec: EnvFileRecord = { id: randomUUID(), environmentId, fileName, createdAt: now(), updatedAt: now() };
  envFiles.set(rec.id, rec);
  return rec;
}

export const store = {
  // ─── Users ───
  async ensureUser(email: string, name?: string): Promise<UserRecord> {
    const e = normalizeEmail(email);
    if (dbMode) return dbStore.dbEnsureUser(e, name);
    const id = usersByEmail.get(e);
    let user = id ? users.get(id) : undefined;
    if (!user) {
      user = { id: randomUUID(), email: e, name, createdAt: now(), updatedAt: now() };
      users.set(user.id, user);
      usersByEmail.set(e, user.id);
      scheduleSnapshotSave();
    } else if (name && !user.name) {
      user.name = name;
      user.updatedAt = now();
      scheduleSnapshotSave();
    }
    return user;
  },

  /** Create a user with a password atomically. Returns null if the email is taken. */
  async createUserWithPassword(email: string, passwordHash: string, name?: string): Promise<UserRecord | null> {
    const e = normalizeEmail(email);
    if (dbMode) return dbStore.dbCreateUserWithPassword(e, passwordHash, name);
    if (usersByEmail.has(e)) return null;
    const user: UserRecord = { id: randomUUID(), email: e, name, passwordHash, createdAt: now(), updatedAt: now() };
    users.set(user.id, user);
    usersByEmail.set(e, user.id);
    scheduleSnapshotSave();
    return user;
  },

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const e = normalizeEmail(email);
    if (dbMode) return dbStore.dbGetUserByEmail(e);
    const id = usersByEmail.get(e);
    return id ? (users.get(id) ?? null) : null;
  },

  async getUserById(id: string): Promise<UserRecord | null> {
    if (dbMode) return dbStore.dbGetUserById(id);
    return users.get(id) ?? null;
  },

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    if (dbMode) return dbStore.dbSetPasswordHash(userId, passwordHash);
    const u = users.get(userId);
    if (!u) throw new Error("User not found");
    u.passwordHash = passwordHash;
    u.updatedAt = now();
    scheduleSnapshotSave();
  },

  // ─── JWT revocation ───
  async revokeJti(jti: string, userId?: string, expiresAtSec?: number): Promise<void> {
    const expMs = (expiresAtSec ?? Math.floor(Date.now() / 1000) + 30 * 24 * 3600) * 1000;
    if (dbMode) return dbStore.dbRevokeJti(jti, userId, new Date(expMs));
    revokedJtis.set(jti, expMs);
    // Prune expired entries so the set doesn't grow forever.
    if (revokedJtis.size % 100 === 0) {
      const t = Date.now();
      for (const [k, v] of revokedJtis) if (v < t) revokedJtis.delete(k);
    }
    scheduleSnapshotSave();
  },

  async isJtiRevoked(jti: string): Promise<boolean> {
    if (dbMode) return dbStore.dbIsJtiRevoked(jti);
    return revokedJtis.has(jti);
  },

  // ─── Projects (always scoped by userId) ───
  async listProjects(userId: string): Promise<ProjectRecord[]> {
    if (dbMode) return dbStore.dbListProjects(userId);
    return [...projectsById.values()].filter((p) => p.userId === userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async findProjectByCanonical(userId: string, canonical: string): Promise<ProjectRecord | null> {
    if (dbMode) return dbStore.dbFindProjectByCanonical(userId, canonical);
    const id = projectsByKey.get(`${userId}:${canonical}`);
    return id ? (projectsById.get(id) ?? null) : null;
  },

  /** Idempotent on (userId, canonicalRemote). */
  async createProject(data: Omit<ProjectRecord, "id" | "createdAt" | "updatedAt">): Promise<ProjectRecord> {
    if (dbMode) return dbStore.dbCreateProject(data);
    const existing = await this.findProjectByCanonical(data.userId, data.canonicalRemote);
    if (existing) return existing;
    const rec: ProjectRecord = { id: randomUUID(), ...data, createdAt: now(), updatedAt: now() };
    projectsById.set(rec.id, rec);
    projectsByKey.set(`${data.userId}:${data.canonicalRemote}`, rec.id);
    scheduleSnapshotSave();
    return rec;
  },

  async getProjectById(userId: string, id: string): Promise<ProjectRecord | null> {
    if (dbMode) return dbStore.dbGetProjectById(userId, id);
    const p = projectsById.get(id);
    return p && p.userId === userId ? p : null;
  },

  /** Deletes the project and everything under it. Returns the object keys to purge, or null if not found. */
  async deleteProject(userId: string, id: string): Promise<string[] | null> {
    if (dbMode) return dbStore.dbDeleteProject(userId, id);
    const p = projectsById.get(id);
    if (!p || p.userId !== userId) return null;
    const keys: string[] = [];
    for (const [k, list] of secretVersions) {
      if (k.startsWith(`${id}:`)) {
        keys.push(...list.map((v) => v.objectKey));
        secretVersions.delete(k);
      }
    }
    for (const env of [...environments.values()].filter((e) => e.projectId === id)) {
      for (const f of [...envFiles.values()].filter((f) => f.environmentId === env.id)) envFiles.delete(f.id);
      environments.delete(env.id);
    }
    projectsByKey.delete(`${userId}:${p.canonicalRemote}`);
    projectsById.delete(id);
    scheduleSnapshotSave();
    return keys;
  },

  // ─── Environments / files (callers must authorize the project first) ───
  async listEnvironments(projectId: string): Promise<EnvironmentRecord[]> {
    if (dbMode) return dbStore.dbListEnvironments(projectId);
    return [...environments.values()].filter((e) => e.projectId === projectId);
  },

  async createEnvironment(projectId: string, name: string, createdBy?: string | undefined): Promise<EnvironmentRecord> {
    if (dbMode) return dbStore.dbCreateEnvironment(projectId, name, createdBy);
    const rec = memEnsureEnvironment(projectId, name, createdBy);
    scheduleSnapshotSave();
    return rec;
  },

  async getEnvironment(id: string): Promise<EnvironmentRecord | null> {
    if (dbMode) return dbStore.dbGetEnvironment(id);
    return environments.get(id) ?? null;
  },

  async listEnvFiles(environmentId: string): Promise<EnvFileRecord[]> {
    if (dbMode) return dbStore.dbListEnvFiles(environmentId);
    return [...envFiles.values()].filter((f) => f.environmentId === environmentId);
  },

  async createEnvFile(environmentId: string, fileName: string): Promise<EnvFileRecord> {
    if (dbMode) return dbStore.dbCreateEnvFile(environmentId, fileName);
    const rec = memEnsureEnvFile(environmentId, fileName);
    scheduleSnapshotSave();
    return rec;
  },

  // ─── Secret versions ───
  /**
   * Append a version to the user's project. Version numbers are sequential
   * per (project, fileName) — the CLI lists by (canonicalRemote, fileName)
   * and treats the last entry as latest.
   */
  async addVersion(v: NewVersionInput): Promise<SecretVersionRecord> {
    if (dbMode) return dbStore.dbAddVersion(v);
    const proj = projectsById.get(v.projectId);
    if (!proj || proj.userId !== v.userId) throw new Error("Project not found");
    const env = memEnsureEnvironment(v.projectId, v.environmentName, v.userId);
    const file = memEnsureEnvFile(env.id, v.fileName);
    const key = `${v.projectId}:${v.fileName}`;
    const list = secretVersions.get(key) ?? [];
    const rec: SecretVersionRecord = {
      id: v.id,
      version: (list.at(-1)?.version ?? 0) + 1,
      environmentFileId: file.id,
      objectKey: v.objectKey,
      cipherAlgorithm: v.cipherAlgorithm,
      algorithm: v.cipherAlgorithm,
      formatVersion: v.formatVersion,
      keyVersion: v.keyVersion,
      nonce: v.nonce,
      authTag: v.authTag,
      ciphertext: v.ciphertext,
      createdAt: now(),
      createdBy: v.userId,
      canonicalRemote: proj.canonicalRemote,
      fileName: v.fileName,
      environmentName: v.environmentName,
    };
    list.push(rec);
    secretVersions.set(key, list);
    scheduleSnapshotSave();
    return rec;
  },

  /** Versions for the user's project at canonicalRemote, ascending. Empty if the user has no such project. */
  async listVersions(userId: string, canonical: string, fileName: string): Promise<SecretVersionRecord[]> {
    if (dbMode) return dbStore.dbListVersions(userId, canonical, fileName);
    const proj = await this.findProjectByCanonical(userId, canonical);
    if (!proj) return [];
    return [...(secretVersions.get(`${proj.id}:${fileName}`) ?? [])];
  },

  async getVersionByNumber(userId: string, canonical: string, fileName: string, version: number): Promise<SecretVersionRecord | null> {
    const list = await this.listVersions(userId, canonical, fileName);
    return list.find((v) => v.version === version) ?? null;
  },

  // ─── Devices (always scoped by userId) ───
  async registerDevice(userId: string, name: string, platform?: string | undefined): Promise<DeviceRecord> {
    if (dbMode) return dbStore.dbRegisterDevice(userId, name, platform);
    const rec: DeviceRecord = { id: randomUUID(), userId, name, platform, lastSeenAt: now(), createdAt: now(), revokedAt: null };
    devices.set(rec.id, rec);
    scheduleSnapshotSave();
    return rec;
  },

  async getDevice(userId: string, deviceId: string): Promise<DeviceRecord | null> {
    if (dbMode) return dbStore.dbGetDevice(userId, deviceId);
    const d = devices.get(deviceId);
    return d && d.userId === userId ? d : null;
  },

  async listDevices(userId: string): Promise<DeviceRecord[]> {
    if (dbMode) return dbStore.dbListDevices(userId);
    return [...devices.values()].filter((d) => d.userId === userId && !d.revokedAt);
  },

  /** Returns false if the device doesn't exist or belongs to someone else. */
  async revokeDevice(userId: string, deviceId: string): Promise<boolean> {
    if (dbMode) return dbStore.dbRevokeDevice(userId, deviceId);
    const d = devices.get(deviceId);
    if (!d || d.userId !== userId || d.revokedAt) return false;
    d.revokedAt = now();
    scheduleSnapshotSave();
    return true;
  },

  async touchDevice(deviceId: string): Promise<void> {
    if (dbMode) return dbStore.dbTouchDevice(deviceId);
    const d = devices.get(deviceId);
    if (d) d.lastSeenAt = now();
  },

  // ─── Audit ───
  async audit(entry: Omit<AuditEntry, "id" | "createdAt">): Promise<void> {
    if (dbMode) return dbStore.dbAudit(entry);
    auditLogs.push({ id: randomUUID(), ...entry, createdAt: now() });
    if (auditLogs.length > 50_000) auditLogs.splice(0, auditLogs.length - 50_000);
    scheduleSnapshotSave();
  },

  async listAuditLogs(userId?: string): Promise<AuditEntry[]> {
    if (dbMode) return dbStore.dbListAuditLogs(userId) as Promise<AuditEntry[]>;
    return userId ? auditLogs.filter((l) => l.userId === userId) : [...auditLogs];
  },

  // Testing helper
  _clearAll(): void {
    users.clear();
    usersByEmail.clear();
    revokedJtis.clear();
    projectsById.clear();
    projectsByKey.clear();
    environments.clear();
    envFiles.clear();
    secretVersions.clear();
    devices.clear();
    auditLogs.length = 0;
  },
};
