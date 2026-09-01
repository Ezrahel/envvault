import { randomUUID } from "node:crypto";

/**
 * Production store uses PostgreSQL via Drizzle (@envvault/database).
 * For MVP/dev/test without DATABASE_URL we use in-memory Maps.
 * Interface is intentionally simple so Drizzle can replace it later without changing routes.
 */

export interface UserRecord {
  id: string;
  email: string;
  name?: string | undefined;
  avatarUrl?: string | undefined;
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

export const store = {
  // Users
  async upsertUser(email: string): Promise<{ user: UserRecord; token: string }> {
    let userId = usersByEmail.get(email);
    let user = userId ? users.get(userId) : undefined;
    if (!user) {
      userId = `user_${email}`;
      // stable id for MVP to keep tests deterministic; prod would use uuid
      user = {
        id: userId,
        email,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      users.set(userId, user);
      usersByEmail.set(email, userId);
    }
    const token = `envvault_mock_${Buffer.from(email).toString("base64").slice(0, 16)}_${randomUUID().slice(0, 8)}`;
    tokens.set(token, user.id);
    return { user, token };
  },

  async getUserByToken(token: string): Promise<UserRecord | null> {
    const userId = tokens.get(token);
    if (!userId) return null;
    return users.get(userId) ?? null;
  },

  async revokeToken(token: string): Promise<void> {
    tokens.delete(token);
  },

  async rotateToken(oldToken: string): Promise<string | null> {
    const userId = tokens.get(oldToken);
    if (!userId) return null;
    tokens.delete(oldToken);
    const newToken = `envvault_mock_${randomUUID().slice(0, 16)}`;
    tokens.set(newToken, userId);
    return newToken;
  },

  // Projects
  async listProjects(userId: string): Promise<ProjectRecord[]> {
    return [...projectsById.values()].filter((p) => p.userId === userId);
  },

  async findProjectByCanonical(userId: string, canonical: string): Promise<ProjectRecord | null> {
    const key = `${userId}:${canonical}`;
    return projects.get(key) ?? null;
  },

  async createProject(data: Omit<ProjectRecord, "id" | "createdAt" | "updatedAt">): Promise<ProjectRecord> {
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
    return rec;
  },

  async getProjectById(userId: string, id: string): Promise<ProjectRecord | null> {
    const p = projectsById.get(id);
    if (!p || p.userId !== userId) return null;
    return p;
  },

  async deleteProject(userId: string, id: string): Promise<boolean> {
    const p = projectsById.get(id);
    if (!p || p.userId !== userId) return false;
    const key = `${userId}:${p.canonicalRemote}`;
    projects.delete(key);
    projectsById.delete(id);
    return true;
  },

  // Environments
  async listEnvironments(projectId: string): Promise<EnvironmentRecord[]> {
    return [...environments.values()].filter((e) => e.projectId === projectId);
  },

  async createEnvironment(projectId: string, name: string, createdBy?: string | undefined): Promise<EnvironmentRecord> {
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
    return rec;
  },

  async getEnvironment(id: string): Promise<EnvironmentRecord | null> {
    return environments.get(id) ?? null;
  },

  // Env Files
  async listEnvFiles(environmentId: string): Promise<EnvFileRecord[]> {
    return [...envFiles.values()].filter((f) => f.environmentId === environmentId);
  },

  async createEnvFile(environmentId: string, fileName: string): Promise<EnvFileRecord> {
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
    return rec;
  },

  // Secret Versions
  async addVersion(v: Omit<SecretVersionRecord, "id" | "version" | "createdAt">): Promise<SecretVersionRecord> {
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
    return rec;
  },

  async listVersions(canonical: string, fileName: string): Promise<SecretVersionRecord[]> {
    return secretVersions.get(`${canonical}:${fileName}`) ?? [];
  },

  async getVersionByNumber(canonical: string, fileName: string, version: number): Promise<SecretVersionRecord | null> {
    const list = secretVersions.get(`${canonical}:${fileName}`) ?? [];
    return list.find((v) => v.version === version) ?? null;
  },

  // Devices
  async registerDevice(userId: string, name: string, platform?: string | undefined): Promise<DeviceRecord> {
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
    return rec;
  },

  async listDevices(userId: string): Promise<DeviceRecord[]> {
    return [...devices.values()].filter((d) => d.userId === userId && !d.revokedAt);
  },

  async revokeDevice(deviceId: string): Promise<void> {
    const d = devices.get(deviceId);
    if (d) d.revokedAt = new Date().toISOString();
  },

  // Audit
  async audit(entry: { userId?: string | undefined; projectId?: string | undefined; action: string; deviceId?: string | undefined; ipHash?: string | undefined }): Promise<void> {
    auditLogs.push({
      id: randomUUID(),
      ...entry,
      createdAt: new Date().toISOString(),
    });
    // Never log secret values — entry is metadata only
  },

  async listAuditLogs(userId?: string): Promise<typeof auditLogs> {
    if (!userId) return auditLogs;
    return auditLogs.filter((l) => l.userId === userId);
  },

  // Testing helper
  _clearAll(): void {
    users.clear();
    usersByEmail.clear();
    tokens.clear();
    projects.clear();
    projectsById.clear();
    environments.clear();
    envFiles.clear();
    secretVersions.clear();
    devices.clear();
    auditLogs.length = 0;
  },
};
