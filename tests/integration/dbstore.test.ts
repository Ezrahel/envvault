import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "../../packages/database/src/schema.js";
import { store, __setDbMode } from "../../apps/api/src/lib/store.js";
import { __setDbOverride } from "../../apps/api/src/lib/db.js";
import { normalizeDatabaseUrl } from "../../apps/api/src/lib/db.js";
import { splitStatements } from "../../apps/api/src/lib/migrate.js";
import { authRoutes } from "../../apps/api/src/routes/auth.js";
import { projectRoutes } from "../../apps/api/src/routes/projects.js";
import { environmentRoutes } from "../../apps/api/src/routes/environments.js";
import { versionRoutes } from "../../apps/api/src/routes/versions.js";

/**
 * CockroachDB cutover tests — executed against PGlite (real Postgres engine,
 * same SQL our migrations + Drizzle queries use). Covers the facade in DB mode
 * end-to-end: users, projects, environments, versions, devices, revocation,
 * and the HTTP auth flow.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const drizzleDir = path.resolve(here, "../../apps/api/drizzle");

let pglite: PGlite;

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(authRoutes, { prefix: "/v1/auth" });
  await app.register(projectRoutes, { prefix: "/v1" });
  await app.register(environmentRoutes, { prefix: "/v1" });
  await app.register(versionRoutes, { prefix: "/v1" });
  return app;
}

beforeAll(async () => {
  pglite = new PGlite();
  // Apply every migration file in order — also validates 0001..0004 SQL syntax.
  const files = (await fs.readdir(drizzleDir)).filter((f) => f.endsWith(".sql")).sort();
  expect(files.length).toBeGreaterThanOrEqual(4);
  for (const f of files) {
    await pglite.exec(await fs.readFile(path.join(drizzleDir, f), "utf-8"));
  }
  const db = drizzlePglite(pglite as any, { schema: schema as any });
  __setDbOverride(db as any);
  __setDbMode(true);
}, 60000);

afterAll(async () => {
  __setDbOverride(null);
  __setDbMode(false);
  await pglite?.close();
});

describe("migrate helpers", () => {
  it("normalizes cockroachdb:// schemes for the postgres driver", () => {
    expect(normalizeDatabaseUrl("cockroachdb://root@host:26257/db?sslmode=verify-full")).toBe(
      "postgresql://root@host:26257/db?sslmode=verify-full"
    );
    expect(normalizeDatabaseUrl("postgresql://a:b@c:5432/d")).toBe("postgresql://a:b@c:5432/d");
  });

  it("splits migration files into statements", () => {
    const parts = splitStatements("-- comment\nCREATE TABLE a (x int);\n\nCREATE INDEX i ON a (x);");
    expect(parts).toHaveLength(2);
  });
});

describe("DbStore via facade (PGlite)", () => {
  it("users: ensure/get/setPassword roundtrip, idempotent ensure", async () => {
    const u1 = await store.ensureUser("db-u1@example.com", "U1");
    expect(u1.id).toBeTruthy();
    expect(u1.id).not.toContain("user_"); // real uuid from DB, not memory-style id
    const u2 = await store.ensureUser("db-u1@example.com");
    expect(u2.id).toBe(u1.id);
    expect(await store.getUserByEmail("db-u1@example.com")).toMatchObject({ id: u1.id });
    expect(await store.getUserByEmail("nope@example.com")).toBeNull();
    await store.setPasswordHash(u1.id, "hashed");
    expect((await store.getUserByEmail("db-u1@example.com"))?.passwordHash).toBe("hashed");
  });

  it("projects: CRUD, uniqueness, user scoping", async () => {
    const a = await store.ensureUser("db-pa@example.com");
    const b = await store.ensureUser("db-pb@example.com");
    const data = { userId: a.id, provider: "github", host: "github.com", owner: "o", repository: "r", canonicalRemote: "github.com/db-o/db-r" };
    const p1 = await store.createProject(data);
    const p2 = await store.createProject(data);
    expect(p2.id).toBe(p1.id); // idempotent on (userId, canonical)
    expect(await store.findProjectByCanonical(a.id, data.canonicalRemote)).toMatchObject({ id: p1.id });
    expect(await store.findProjectByCanonical(b.id, data.canonicalRemote)).toBeNull();
    expect(await store.getProjectById(b.id, p1.id)).toBeNull();
    expect((await store.listProjects(a.id)).map((p) => p.id)).toContain(p1.id);
    expect(await store.deleteProject(b.id, p1.id)).toBe(false);
    expect(await store.deleteProject(a.id, p1.id)).toBe(true);
    expect(await store.getProjectById(a.id, p1.id)).toBeNull();
  });

  it("environments + files: idempotent creates", async () => {
    const u = await store.ensureUser("db-env@example.com");
    const p = await store.createProject({ userId: u.id, provider: "github", host: "github.com", repository: "r", canonicalRemote: "github.com/db-env/r" });
    const e1 = await store.createEnvironment(p.id, "development", u.id);
    const e2 = await store.createEnvironment(p.id, "development", u.id);
    expect(e2.id).toBe(e1.id);
    expect(e1.createdBy).toBe(u.id);
    const f1 = await store.createEnvFile(e1.id, ".env");
    expect((await store.createEnvFile(e1.id, ".env")).id).toBe(f1.id);
    expect((await store.listEnvFiles(e1.id)).map((f) => f.fileName)).toEqual([".env"]);
    expect(await store.getEnvironment(e1.id)).toMatchObject({ name: "development" });
  });

  it("versions: sequencing, payload shape, lookup", async () => {
    const u = await store.ensureUser("db-ver@example.com");
    const canon = "github.com/db-ver/r";
    await store.createProject({ userId: u.id, provider: "github", host: "github.com", repository: "r", canonicalRemote: canon });
    const base = { objectKey: "k", cipherAlgorithm: "AES-256-GCM", keyVersion: 1, nonce: "n", authTag: "t", ciphertext: "C1", canonicalRemote: canon, fileName: ".env", createdBy: u.id };
    const v1 = await store.addVersion({ ...base, environmentName: "development" });
    expect(v1.version).toBe(1);
    const v2 = await store.addVersion({ ...base, ciphertext: "C2", environmentName: "development" });
    expect(v2.version).toBe(2);
    const list = await store.listVersions(canon, ".env");
    expect(list.map((v) => v.version)).toEqual([1, 2]);
    expect(list[0]).toMatchObject({ ciphertext: "C1", authTag: "t", formatVersion: 1, canonicalRemote: canon, fileName: ".env", environmentName: "development" });
    expect(await store.getVersionByNumber(canon, ".env", 2)).toMatchObject({ ciphertext: "C2" });
    expect(await store.getVersionByNumber(canon, ".env", 99)).toBeNull();
    expect(await store.listVersions(canon, "missing")).toEqual([]);
  });

  it("revocation + devices roundtrip", async () => {
    await store.revokeJti("jti-123");
    expect(await store.isJtiRevoked("jti-123")).toBe(true);
    expect(await store.isJtiRevoked("jti-other")).toBe(false);
    const u = await store.ensureUser("db-dev@example.com");
    const d = await store.registerDevice(u.id, "laptop", "linux");
    expect((await store.listDevices(u.id)).map((x) => x.id)).toContain(d.id);
    await store.revokeDevice(d.id);
    expect(await store.listDevices(u.id)).toEqual([]);
  });

  it("HTTP auth flow works against the DB backend", async () => {
    const app = await buildApp();
    const reg = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email: "db-http@example.com", password: "supersecret1" } });
    expect(reg.statusCode).toBe(201);
    const { token } = JSON.parse(reg.body);
    expect(token.split(".").length).toBe(3);

    const proj = await app.inject({
      method: "POST", url: "/v1/projects", headers: { Authorization: `Bearer ${token}` },
      payload: { provider: "github", host: "github.com", repository: "r", canonicalRemote: "github.com/db-http/r" },
    });
    expect(proj.statusCode).toBe(201);

    const payload = {
      project: { provider: "github", host: "github.com", repository: "r", canonicalRemote: "github.com/db-http/r" },
      environment: { name: "production", fileName: ".env" },
      encryption: { algorithm: "AES-256-GCM", keyVersion: 1, nonce: "n", authTag: "t" },
      ciphertext: "DB_CIPHERTEXT",
    };
    const up = await app.inject({
      method: "POST", url: "/v1/environment-files/x/versions", headers: { Authorization: `Bearer ${token}` }, payload,
    });
    expect(up.statusCode).toBe(201);

    const list = await app.inject({
      method: "GET",
      url: "/v1/environment-files/mock/versions?canonicalRemote=github.com%2Fdb-http%2Fr&fileName=.env",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    const versions = JSON.parse(list.body);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ ciphertext: "DB_CIPHERTEXT", environmentName: "production" });

    // logout revokes via DB-backed revoked_tokens
    await app.inject({ method: "POST", url: "/v1/auth/logout", headers: { Authorization: `Bearer ${token}` } });
    const after = await app.inject({ method: "GET", url: "/v1/projects", headers: { Authorization: `Bearer ${token}` } });
    expect(after.statusCode).toBe(401);
    await app.close();
  });
});
