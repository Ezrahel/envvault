import { eq, and, isNull, lt, inArray, desc, sql } from "drizzle-orm";
import * as s from "@envvault/database";
import { getDb } from "./db.js";
import type { NewVersionInput, SecretVersionRecord } from "./store.js";

/**
 * Drizzle-backed store for CockroachDB (Postgres-wire compatible).
 * Mirrors the in-memory store's method surface exactly.
 *
 * TENANCY: every project-scoped query filters on user_id. Version lookups go
 * (userId, canonicalRemote) → project → environments → files → versions.
 *
 * Cockroach notes:
 * - Query-builder statements only (plus trivial `lower()`), `prepare: false` on the driver.
 * - Version numbers are MAX+1 per (project, fileName), guarded by a unique
 *   index on (environment_file_id, version) with retry on conflict.
 */

function mustDb() {
  const db = getDb();
  if (!db) throw new Error("Database not configured");
  return db;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Malformed ids are "not found", never a 500 from a uuid cast error. */
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

function iso(d: Date | string | null | undefined): string {
  if (d instanceof Date) return d.toISOString();
  if (typeof d === "string") return d;
  return new Date(0).toISOString();
}

const opt = <T>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string }; message?: string };
  const code = err?.code ?? err?.cause?.code;
  return code === "23505" || /duplicate key|unique constraint/i.test(String(err?.message ?? ""));
}

// ─── Users ───

function mapUser(row: typeof s.users.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    name: opt(row.name),
    avatarUrl: opt(row.avatarUrl),
    passwordHash: opt(row.passwordHash),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function dbGetUserByEmail(email: string) {
  const db = mustDb();
  // Case-insensitive so rows created before email normalization still match.
  const rows = await db
    .select()
    .from(s.users)
    .where(sql`lower(${s.users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function dbGetUserById(id: string) {
  if (!isUuid(id)) return null;
  const db = mustDb();
  const rows = await db.select().from(s.users).where(eq(s.users.id, id)).limit(1);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function dbEnsureUser(email: string, name?: string) {
  const db = mustDb();
  let user = await dbGetUserByEmail(email);
  if (!user) {
    await db.insert(s.users).values({ email, name: name ?? null }).onConflictDoNothing({ target: s.users.email });
    user = await dbGetUserByEmail(email);
    if (!user) throw new Error("Failed to ensure user");
  }
  if (name && !user.name) {
    await db.update(s.users).set({ name, updatedAt: new Date() }).where(eq(s.users.id, user.id));
    user.name = name;
  }
  return user;
}

export async function dbCreateUserWithPassword(email: string, passwordHash: string, name?: string) {
  if (await dbGetUserByEmail(email)) return null;
  const db = mustDb();
  try {
    const rows = await db.insert(s.users).values({ email, passwordHash, name: name ?? null }).onConflictDoNothing({ target: s.users.email }).returning();
    return rows[0] ? mapUser(rows[0]) : null;
  } catch (e) {
    if (isUniqueViolation(e)) return null;
    throw e;
  }
}

export async function dbSetPasswordHash(userId: string, passwordHash: string): Promise<void> {
  const db = mustDb();
  await db.update(s.users).set({ passwordHash, updatedAt: new Date() }).where(eq(s.users.id, userId));
}

// ─── JWT revocation ───

export async function dbRevokeJti(jti: string, userId: string | undefined, expiresAt: Date): Promise<void> {
  const db = mustDb();
  await db
    .insert(s.revokedTokens)
    .values({ jti, userId: isUuid(userId) ? userId : null, expiresAt })
    .onConflictDoNothing({ target: s.revokedTokens.jti });
  // Opportunistic prune — rows past their token's expiry can never matter again.
  await db.delete(s.revokedTokens).where(lt(s.revokedTokens.expiresAt, new Date())).catch(() => {});
}

export async function dbIsJtiRevoked(jti: string): Promise<boolean> {
  const db = mustDb();
  const rows = await db.select({ jti: s.revokedTokens.jti }).from(s.revokedTokens).where(eq(s.revokedTokens.jti, jti)).limit(1);
  return rows.length > 0;
}

// ─── Projects ───

function mapProject(row: typeof s.projects.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    host: row.host,
    owner: opt(row.owner),
    repository: row.repository,
    canonicalRemote: row.canonicalRemote,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function dbListProjects(userId: string) {
  const db = mustDb();
  const rows = await db.select().from(s.projects).where(eq(s.projects.userId, userId)).orderBy(s.projects.createdAt);
  return rows.map(mapProject);
}

export async function dbFindProjectByCanonical(userId: string, canonical: string) {
  const db = mustDb();
  const rows = await db
    .select()
    .from(s.projects)
    .where(and(eq(s.projects.userId, userId), eq(s.projects.canonicalRemote, canonical)))
    .limit(1);
  return rows[0] ? mapProject(rows[0]) : null;
}

export async function dbCreateProject(data: {
  userId: string;
  provider: string;
  host: string;
  owner?: string | undefined;
  repository: string;
  canonicalRemote: string;
}) {
  const existing = await dbFindProjectByCanonical(data.userId, data.canonicalRemote);
  if (existing) return existing;
  const db = mustDb();
  try {
    const rows = await db
      .insert(s.projects)
      .values({ userId: data.userId, provider: data.provider, host: data.host, owner: data.owner ?? null, repository: data.repository, canonicalRemote: data.canonicalRemote })
      .returning();
    return mapProject(rows[0]!);
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // Lost a create race — return the winner.
    const winner = await dbFindProjectByCanonical(data.userId, data.canonicalRemote);
    if (!winner) throw e;
    return winner;
  }
}

export async function dbGetProjectById(userId: string, id: string) {
  if (!isUuid(id)) return null;
  const db = mustDb();
  const rows = await db
    .select()
    .from(s.projects)
    .where(and(eq(s.projects.id, id), eq(s.projects.userId, userId)))
    .limit(1);
  return rows[0] ? mapProject(rows[0]) : null;
}

/** Returns object keys to purge from storage, or null if not found / not owned. */
export async function dbDeleteProject(userId: string, id: string): Promise<string[] | null> {
  const proj = await dbGetProjectById(userId, id);
  if (!proj) return null;
  const db = mustDb();
  const envIds = (await db.select({ id: s.environments.id }).from(s.environments).where(eq(s.environments.projectId, id))).map((r) => r.id);
  const fileIds = envIds.length
    ? (await db.select({ id: s.environmentFiles.id }).from(s.environmentFiles).where(inArray(s.environmentFiles.environmentId, envIds))).map((r) => r.id)
    : [];
  const keys = fileIds.length
    ? (await db.select({ k: s.secretVersions.objectKey }).from(s.secretVersions).where(inArray(s.secretVersions.environmentFileId, fileIds))).map((r) => r.k)
    : [];
  // Audit rows reference the project; detach them so history survives the delete.
  await db.update(s.auditLogs).set({ projectId: null }).where(eq(s.auditLogs.projectId, id));
  // Cascades to environments → files → versions via FK ON DELETE CASCADE.
  await db.delete(s.projects).where(and(eq(s.projects.id, id), eq(s.projects.userId, userId)));
  return keys;
}

// ─── Environments / files ───

function mapEnvironment(row: typeof s.environments.$inferSelect) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    createdBy: opt(row.createdBy),
  };
}

export async function dbListEnvironments(projectId: string) {
  if (!isUuid(projectId)) return [];
  const db = mustDb();
  const rows = await db.select().from(s.environments).where(eq(s.environments.projectId, projectId)).orderBy(s.environments.createdAt);
  return rows.map(mapEnvironment);
}

async function findEnvironment(projectId: string, name: string) {
  const db = mustDb();
  const rows = await db
    .select()
    .from(s.environments)
    .where(and(eq(s.environments.projectId, projectId), eq(s.environments.name, name)))
    .limit(1);
  return rows[0] ? mapEnvironment(rows[0]) : null;
}

export async function dbCreateEnvironment(projectId: string, name: string, createdBy?: string | undefined) {
  const existing = await findEnvironment(projectId, name);
  if (existing) return existing;
  const db = mustDb();
  try {
    const rows = await db
      .insert(s.environments)
      .values({ projectId, name, createdBy: isUuid(createdBy) ? createdBy : null })
      .returning();
    return mapEnvironment(rows[0]!);
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const winner = await findEnvironment(projectId, name);
    if (!winner) throw e;
    return winner;
  }
}

export async function dbGetEnvironment(id: string) {
  if (!isUuid(id)) return null;
  const db = mustDb();
  const rows = await db.select().from(s.environments).where(eq(s.environments.id, id)).limit(1);
  return rows[0] ? mapEnvironment(rows[0]) : null;
}

function mapEnvFile(row: typeof s.environmentFiles.$inferSelect) {
  return { id: row.id, environmentId: row.environmentId, fileName: row.fileName, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
}

export async function dbListEnvFiles(environmentId: string) {
  if (!isUuid(environmentId)) return [];
  const db = mustDb();
  const rows = await db.select().from(s.environmentFiles).where(eq(s.environmentFiles.environmentId, environmentId));
  return rows.map(mapEnvFile);
}

async function findEnvFile(environmentId: string, fileName: string) {
  const db = mustDb();
  const rows = await db
    .select()
    .from(s.environmentFiles)
    .where(and(eq(s.environmentFiles.environmentId, environmentId), eq(s.environmentFiles.fileName, fileName)))
    .limit(1);
  return rows[0] ? mapEnvFile(rows[0]) : null;
}

export async function dbCreateEnvFile(environmentId: string, fileName: string) {
  const existing = await findEnvFile(environmentId, fileName);
  if (existing) return existing;
  const db = mustDb();
  try {
    const rows = await db.insert(s.environmentFiles).values({ environmentId, fileName }).returning();
    return mapEnvFile(rows[0]!);
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const winner = await findEnvFile(environmentId, fileName);
    if (!winner) throw e;
    return winner;
  }
}

// ─── Secret versions ───

/** All env-file rows named `fileName` under the project (one per environment). */
async function projectFiles(projectId: string, fileName: string) {
  const db = mustDb();
  const envs = await db.select().from(s.environments).where(eq(s.environments.projectId, projectId));
  if (envs.length === 0) return [];
  const files = await db
    .select()
    .from(s.environmentFiles)
    .where(and(inArray(s.environmentFiles.environmentId, envs.map((e) => e.id)), eq(s.environmentFiles.fileName, fileName)));
  const envName = new Map(envs.map((e) => [e.id, e.name]));
  return files.map((f) => ({ file: f, environmentName: envName.get(f.environmentId) ?? "default" }));
}

function mapVersion(
  v: typeof s.secretVersions.$inferSelect,
  ctx: { canonicalRemote: string; fileName: string; environmentName: string },
): SecretVersionRecord {
  return {
    id: v.id,
    version: v.version,
    environmentFileId: v.environmentFileId,
    objectKey: v.objectKey,
    cipherAlgorithm: v.cipherAlgorithm,
    algorithm: v.cipherAlgorithm,
    formatVersion: v.formatVersion ?? 1,
    keyVersion: v.keyVersion,
    nonce: v.nonce,
    authTag: opt(v.authTag),
    ciphertext: opt(v.ciphertext),
    createdAt: iso(v.createdAt),
    createdBy: opt(v.createdBy),
    ...ctx,
  };
}

export async function dbListVersions(userId: string, canonical: string, fileName: string): Promise<SecretVersionRecord[]> {
  const proj = await dbFindProjectByCanonical(userId, canonical);
  if (!proj) return [];
  const files = await projectFiles(proj.id, fileName);
  if (files.length === 0) return [];
  const db = mustDb();
  const byFile = new Map(files.map((f) => [f.file.id, f.environmentName]));
  const rows = await db
    .select()
    .from(s.secretVersions)
    .where(inArray(s.secretVersions.environmentFileId, [...byFile.keys()]))
    .orderBy(s.secretVersions.version);
  return rows.map((v) => mapVersion(v, { canonicalRemote: canonical, fileName, environmentName: byFile.get(v.environmentFileId) ?? "default" }));
}

export async function dbAddVersion(v: NewVersionInput): Promise<SecretVersionRecord> {
  const db = mustDb();
  const proj = await dbGetProjectById(v.userId, v.projectId);
  if (!proj) throw new Error("Project not found");
  const env = await dbCreateEnvironment(proj.id, v.environmentName, v.userId);
  const file = await dbCreateEnvFile(env.id, v.fileName);

  // MAX+1 across the project's files with this name; the unique index on
  // (environment_file_id, version) turns a concurrent duplicate into a retry.
  for (let attempt = 0; attempt < 5; attempt++) {
    const files = await projectFiles(proj.id, v.fileName);
    const latest = await db
      .select({ version: s.secretVersions.version })
      .from(s.secretVersions)
      .where(inArray(s.secretVersions.environmentFileId, files.map((f) => f.file.id)))
      .orderBy(desc(s.secretVersions.version))
      .limit(1);
    const version = (latest[0]?.version ?? 0) + 1;
    try {
      const rows = await db
        .insert(s.secretVersions)
        .values({
          id: v.id,
          environmentFileId: file.id,
          version,
          objectKey: v.objectKey,
          cipherAlgorithm: v.cipherAlgorithm,
          keyVersion: v.keyVersion,
          nonce: v.nonce,
          authTag: v.authTag ?? null,
          ciphertext: v.ciphertext,
          formatVersion: v.formatVersion,
          createdBy: v.userId,
        })
        .returning();
      return mapVersion(rows[0]!, { canonicalRemote: proj.canonicalRemote, fileName: v.fileName, environmentName: env.name });
    } catch (e) {
      if (!isUniqueViolation(e) || attempt === 4) throw e;
      await new Promise((r) => setTimeout(r, 10 + Math.random() * 40));
    }
  }
  throw new Error("Failed to allocate version number");
}

// ─── Devices ───

function mapDevice(row: typeof s.devices.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    platform: opt(row.platform),
    lastSeenAt: iso(row.lastSeenAt),
    createdAt: iso(row.createdAt),
    revokedAt: row.revokedAt ? iso(row.revokedAt) : null,
  };
}

export async function dbRegisterDevice(userId: string, name: string, platform?: string | undefined) {
  const db = mustDb();
  const rows = await db
    .insert(s.devices)
    .values({ userId, name: name.slice(0, 255), platform: platform ? platform.slice(0, 50) : null })
    .returning();
  return mapDevice(rows[0]!);
}

export async function dbGetDevice(userId: string, deviceId: string) {
  if (!isUuid(deviceId)) return null;
  const db = mustDb();
  const rows = await db
    .select()
    .from(s.devices)
    .where(and(eq(s.devices.id, deviceId), eq(s.devices.userId, userId)))
    .limit(1);
  return rows[0] ? mapDevice(rows[0]) : null;
}

export async function dbListDevices(userId: string) {
  const db = mustDb();
  const rows = await db
    .select()
    .from(s.devices)
    .where(and(eq(s.devices.userId, userId), isNull(s.devices.revokedAt)))
    .orderBy(s.devices.createdAt);
  return rows.map(mapDevice);
}

export async function dbRevokeDevice(userId: string, deviceId: string): Promise<boolean> {
  if (!isUuid(deviceId)) return false;
  const db = mustDb();
  const rows = await db
    .update(s.devices)
    .set({ revokedAt: new Date() })
    .where(and(eq(s.devices.id, deviceId), eq(s.devices.userId, userId), isNull(s.devices.revokedAt)))
    .returning({ id: s.devices.id });
  return rows.length > 0;
}

export async function dbTouchDevice(deviceId: string): Promise<void> {
  if (!isUuid(deviceId)) return;
  const db = mustDb();
  await db.update(s.devices).set({ lastSeenAt: new Date() }).where(eq(s.devices.id, deviceId));
}

// ─── Audit ───

export async function dbAudit(entry: {
  userId?: string | undefined;
  projectId?: string | undefined;
  action: string;
  deviceId?: string | undefined;
  ipHash?: string | undefined;
}): Promise<void> {
  const db = mustDb();
  const base = {
    userId: isUuid(entry.userId) ? entry.userId : null,
    projectId: isUuid(entry.projectId) ? entry.projectId : null,
    action: entry.action.slice(0, 100),
    ipHash: entry.ipHash ?? null,
  };
  // deviceId is an FK; a stale/foreign id must not fail the request — retry without it.
  try {
    await db.insert(s.auditLogs).values({ ...base, deviceId: isUuid(entry.deviceId) ? entry.deviceId : null });
  } catch {
    await db.insert(s.auditLogs).values({ ...base, deviceId: null, projectId: null });
  }
}

export async function dbListAuditLogs(userId?: string) {
  const db = mustDb();
  const rows = userId
    ? await db.select().from(s.auditLogs).where(eq(s.auditLogs.userId, userId)).orderBy(s.auditLogs.createdAt).limit(5000)
    : await db.select().from(s.auditLogs).orderBy(s.auditLogs.createdAt).limit(5000);
  return rows.map((r) => ({
    id: r.id,
    userId: opt(r.userId),
    projectId: opt(r.projectId),
    action: r.action,
    deviceId: opt(r.deviceId),
    ipHash: opt(r.ipHash),
    createdAt: iso(r.createdAt),
  }));
}
