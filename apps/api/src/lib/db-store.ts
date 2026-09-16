import { eq, and, isNull, lt } from "drizzle-orm";
import * as s from "@envvault/database";
import { getDb } from "./db.js";

/**
 * Drizzle-backed store for CockroachDB (Postgres-wire compatible).
 * Mirrors the in-memory store's method surface and semantics (including its
 * quirks — e.g. versions keyed by (canonicalRemote, fileName) across
 * environments) so the facade in store.ts can swap backends safely.
 *
 * Cockroach notes:
 * - Only query-builder statements (no raw SQL) for maximum compatibility.
 * - `prepare: false` is set on the driver (see db.ts).
 * - Version numbering is read-then-insert (MAX+1); under heavy concurrent
 *   uploads to the same file this can race — acceptable for MVP single-node,
 *   revisit with a unique (environment_file_id, version) constraint + retry.
 */

function mustDb() {
  const db = getDb();
  if (!db) throw new Error("Database not configured");
  return db;
}

function iso(d: Date | string | null | undefined): string {
  if (d instanceof Date) return d.toISOString();
  if (typeof d === "string") return d;
  return new Date(0).toISOString();
}

const opt = <T>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);

// ─── Users ───

export async function dbEnsureUser(email: string, name?: string) {
  const db = mustDb();
  await db.insert(s.users).values({ email, name: name ?? null }).onConflictDoNothing({ target: s.users.email });
  const rows = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
  const row = rows[0];
  if (!row) throw new Error("Failed to ensure user");
  if (name && !row.name) {
    await db.update(s.users).set({ name }).where(eq(s.users.id, row.id));
    row.name = name;
  }
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
  const rows = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
  const row = rows[0];
  if (!row) return null;
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

export async function dbSetPasswordHash(userId: string, passwordHash: string): Promise<void> {
  const db = mustDb();
  await db.update(s.users).set({ passwordHash, updatedAt: new Date() }).where(eq(s.users.id, userId));
}

// ─── JWT revocation ───

const REVOKED_TTL_MS = 30 * 24 * 3600 * 1000; // >= max refresh TTL; rows pruned after expiry

export async function dbRevokeJti(jti: string, userId?: string): Promise<void> {
  const db = mustDb();
  await db
    .insert(s.revokedTokens)
    .values({ jti, userId: userId ?? null, expiresAt: new Date(Date.now() + REVOKED_TTL_MS) })
    .onConflictDoNothing({ target: s.revokedTokens.jti });
  // Opportunistic prune of expired rows
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
  } catch {
    // Lost a create race — re-read the winner (idempotent, matches memory semantics).
    const winner = await dbFindProjectByCanonical(data.userId, data.canonicalRemote);
    if (!winner) throw new Error("Failed to create project");
    return winner;
  }
}

export async function dbGetProjectById(userId: string, id: string) {
  const db = mustDb();
  const rows = await db.select().from(s.projects).where(eq(s.projects.id, id)).limit(1);
  const row = rows[0];
  if (!row || row.userId !== userId) return null;
  return mapProject(row);
}

export async function dbDeleteProject(userId: string, id: string): Promise<boolean> {
  const proj = await dbGetProjectById(userId, id);
  if (!proj) return false;
  const db = mustDb();
  // Cascades to environments → files → versions via FK ON DELETE CASCADE.
  await db.delete(s.projects).where(eq(s.projects.id, id));
  return true;
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
  const db = mustDb();
  const rows = await db.select().from(s.environments).where(eq(s.environments.projectId, projectId));
  return rows.map(mapEnvironment);
}

export async function dbCreateEnvironment(projectId: string, name: string, createdBy?: string | undefined) {
  const db = mustDb();
  const existing = await db
    .select()
    .from(s.environments)
    .where(and(eq(s.environments.projectId, projectId), eq(s.environments.name, name)))
    .limit(1);
  if (existing[0]) return mapEnvironment(existing[0]);
  try {
    const rows = await db.insert(s.environments).values({ projectId, name, createdBy: createdBy ?? null }).returning();
    return mapEnvironment(rows[0]!);
  } catch {
    const winner = await db
      .select()
      .from(s.environments)
      .where(and(eq(s.environments.projectId, projectId), eq(s.environments.name, name)))
      .limit(1);
    if (!winner[0]) throw new Error("Failed to create environment");
    return mapEnvironment(winner[0]);
  }
}

export async function dbGetEnvironment(id: string) {
  const db = mustDb();
  const rows = await db.select().from(s.environments).where(eq(s.environments.id, id)).limit(1);
  return rows[0] ? mapEnvironment(rows[0]) : null;
}

function mapEnvFile(row: typeof s.environmentFiles.$inferSelect) {
  return { id: row.id, environmentId: row.environmentId, fileName: row.fileName, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
}

export async function dbListEnvFiles(environmentId: string) {
  const db = mustDb();
  const rows = await db.select().from(s.environmentFiles).where(eq(s.environmentFiles.environmentId, environmentId));
  return rows.map(mapEnvFile);
}

export async function dbCreateEnvFile(environmentId: string, fileName: string) {
  const db = mustDb();
  const existing = await db
    .select()
    .from(s.environmentFiles)
    .where(and(eq(s.environmentFiles.environmentId, environmentId), eq(s.environmentFiles.fileName, fileName)))
    .limit(1);
  if (existing[0]) return mapEnvFile(existing[0]);
  try {
    const rows = await db.insert(s.environmentFiles).values({ environmentId, fileName }).returning();
    return mapEnvFile(rows[0]!);
  } catch {
    const winner = await db
      .select()
      .from(s.environmentFiles)
      .where(and(eq(s.environmentFiles.environmentId, environmentId), eq(s.environmentFiles.fileName, fileName)))
      .limit(1);
    if (!winner[0]) throw new Error("Failed to create environment file");
    return mapEnvFile(winner[0]);
  }
}

// ─── Secret versions ───

function mapVersionRow(r: {
  v: typeof s.secretVersions.$inferSelect;
  f: typeof s.environmentFiles.$inferSelect;
  e: typeof s.environments.$inferSelect;
  p: typeof s.projects.$inferSelect;
}) {
  return {
    id: r.v.id,
    version: r.v.version,
    environmentFileId: r.v.environmentFileId,
    objectKey: r.v.objectKey,
    cipherAlgorithm: r.v.cipherAlgorithm,
    algorithm: r.v.cipherAlgorithm,
    formatVersion: r.v.formatVersion ?? 1,
    keyVersion: r.v.keyVersion,
    nonce: r.v.nonce,
    authTag: opt(r.v.authTag),
    ciphertext: opt(r.v.ciphertext),
    createdAt: iso(r.v.createdAt),
    createdBy: opt(r.v.createdBy),
    canonicalRemote: r.p.canonicalRemote,
    fileName: r.f.fileName,
    environmentName: r.e.name,
  };
}

async function dbQueryVersions(canonical: string, fileName: string) {
  // Sequential single-table queries (no joins): avoids duplicate-column
  // ambiguity in joined result mapping and behaves identically on
  // CockroachDB and PostgreSQL. Sorted to match memory ordering (version asc).
  const db = mustDb();
  const out: Array<{
    v: typeof s.secretVersions.$inferSelect;
    f: typeof s.environmentFiles.$inferSelect;
    e: typeof s.environments.$inferSelect;
    p: typeof s.projects.$inferSelect;
  }> = [];
  const projs = await db.select().from(s.projects).where(eq(s.projects.canonicalRemote, canonical));
  for (const p of projs) {
    const envs = await db.select().from(s.environments).where(eq(s.environments.projectId, p.id));
    for (const e of envs) {
      const files = await db
        .select()
        .from(s.environmentFiles)
        .where(and(eq(s.environmentFiles.environmentId, e.id), eq(s.environmentFiles.fileName, fileName)));
      for (const f of files) {
        const vers = await db
          .select()
          .from(s.secretVersions)
          .where(eq(s.secretVersions.environmentFileId, f.id))
          .orderBy(s.secretVersions.version);
        for (const v of vers) out.push({ v, f, e, p });
      }
    }
  }
  out.sort((a, b) => a.v.version - b.v.version);
  return out;
}

export async function dbListVersions(canonical: string, fileName: string) {
  return (await dbQueryVersions(canonical, fileName)).map(mapVersionRow);
}

export async function dbGetVersionByNumber(canonical: string, fileName: string, version: number) {
  const rows = await dbQueryVersions(canonical, fileName);
  const found = rows.find((r) => r.v.version === version);
  return found ? mapVersionRow(found) : null;
}

export async function dbAddVersion(v: {
  objectKey: string;
  cipherAlgorithm: string;
  algorithm?: string | undefined;
  formatVersion?: number | undefined;
  keyVersion: number;
  nonce: string;
  authTag?: string | undefined;
  ciphertext?: string | undefined;
  canonicalRemote: string;
  fileName: string;
  environmentName: string;
  createdBy?: string | undefined;
}) {
  const db = mustDb();
  // Resolve the relational chain. The project is created by the route before
  // upload; environment + file rows are ensured here for the FK.
  const projRows = await db.select().from(s.projects).where(eq(s.projects.canonicalRemote, v.canonicalRemote)).limit(1);
  const proj = projRows[0];
  if (!proj) throw new Error(`Project not found for canonicalRemote: ${v.canonicalRemote}`);
  const env = await dbCreateEnvironment(proj.id, v.environmentName, v.createdBy);
  const file = await dbCreateEnvFile(env.id, v.fileName);

  // Version number mirrors memory semantics: sequential per (canonical, fileName).
  const existing = await dbQueryVersions(v.canonicalRemote, v.fileName);
  const version = existing.length + 1;

  const rows = await db
    .insert(s.secretVersions)
    .values({
      environmentFileId: file.id,
      version,
      objectKey: v.objectKey,
      cipherAlgorithm: v.cipherAlgorithm,
      keyVersion: v.keyVersion,
      nonce: v.nonce,
      authTag: v.authTag ?? null,
      ciphertext: v.ciphertext ?? null,
      formatVersion: v.formatVersion ?? 1,
      createdBy: v.createdBy ?? null,
    })
    .returning();
  const row = rows[0]!;
  return {
    id: row.id,
    version: row.version,
    environmentFileId: row.environmentFileId,
    objectKey: row.objectKey,
    cipherAlgorithm: row.cipherAlgorithm,
    algorithm: row.cipherAlgorithm,
    formatVersion: row.formatVersion ?? 1,
    keyVersion: row.keyVersion,
    nonce: row.nonce,
    authTag: opt(row.authTag),
    ciphertext: opt(row.ciphertext),
    createdAt: iso(row.createdAt),
    createdBy: opt(row.createdBy),
    canonicalRemote: v.canonicalRemote,
    fileName: v.fileName,
    environmentName: v.environmentName,
  };
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
  const rows = await db.insert(s.devices).values({ userId, name, platform: platform ?? null }).returning();
  return mapDevice(rows[0]!);
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

export async function dbRevokeDevice(deviceId: string): Promise<void> {
  const db = mustDb();
  await db.update(s.devices).set({ revokedAt: new Date() }).where(eq(s.devices.id, deviceId));
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
  // deviceId may be an arbitrary client header (x-device-id), not a devices FK —
  // retry without it rather than failing the request on FK violation.
  try {
    await db.insert(s.auditLogs).values({
      userId: entry.userId ?? null,
      projectId: entry.projectId ?? null,
      action: entry.action,
      deviceId: entry.deviceId ?? null,
      ipHash: entry.ipHash ?? null,
    });
  } catch {
    await db.insert(s.auditLogs).values({
      userId: entry.userId ?? null,
      projectId: entry.projectId ?? null,
      action: entry.action,
      deviceId: null,
      ipHash: entry.ipHash ?? null,
    });
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
