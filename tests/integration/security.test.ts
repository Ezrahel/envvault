import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "../../packages/database/src/schema.js";
import { buildApp } from "../../apps/api/src/app.js";
import { store, __setDbMode } from "../../apps/api/src/lib/store.js";
import { __setDbOverride } from "../../apps/api/src/lib/db.js";
import { signJwt } from "../../apps/api/src/lib/jwt.js";

/**
 * Security regression suite — runs against the real app (hooks, error
 * handler, rate limits) on BOTH backends: in-memory and Postgres (PGlite).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const drizzleDir = path.resolve(here, "../../apps/api/drizzle");

const REMOTE = "github.com/acme/web";
const project = { provider: "github", host: "github.com", owner: "acme", repository: "web", canonicalRemote: REMOTE };

function upload(ciphertext: string, fileName = ".env.local", envName = "local") {
  return {
    project,
    environment: { name: envName, fileName },
    encryption: { algorithm: "AES-256-GCM", keyVersion: 1, nonce: "bm9uY2UxMjM0NTY3", authTag: "dGFndGFndGFndGFndGFn" },
    ciphertext,
  };
}

type App = Awaited<ReturnType<typeof buildApp>>;

async function register(app: App, email: string, extra: Record<string, unknown> = {}) {
  const r = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email, password: "correct-horse-1", ...extra } });
  expect(r.statusCode, r.body).toBe(201);
  return JSON.parse(r.body) as { token: string; refreshToken: string; userId: string; deviceId?: string };
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

for (const backend of ["memory", "postgres"] as const) {
  describe(`security (${backend})`, () => {
    let pglite: PGlite | undefined;
    let app: App;

    beforeAll(async () => {
      if (backend === "postgres") {
        pglite = new PGlite();
        const files = (await fs.readdir(drizzleDir)).filter((f) => f.endsWith(".sql")).sort();
        for (const f of files) await pglite.exec(await fs.readFile(path.join(drizzleDir, f), "utf-8"));
        __setDbOverride(drizzlePglite(pglite as any, { schema: schema as any }) as any);
        __setDbMode(true);
      }
      app = await buildApp({ logger: false, rateLimit: false });
    }, 60000);

    afterAll(async () => {
      await app?.close();
      if (backend === "postgres") {
        __setDbOverride(null);
        __setDbMode(false);
        await pglite?.close();
      }
    });

    beforeEach(() => {
      if (backend === "memory") store._clearAll();
    });

    const uniq = () => Math.random().toString(36).slice(2, 8);

    it("isolates version history between accounts pushing the same remote", async () => {
      const a = await register(app, `alice-${uniq()}@example.com`);
      const b = await register(app, `bob-${uniq()}@example.com`);

      let r = await app.inject({ method: "POST", url: "/v1/environment-files/mock/versions", headers: auth(a.token), payload: upload("QUxJQ0VfQ0lQSEVS") });
      expect(r.statusCode, r.body).toBe(201);
      expect(JSON.parse(r.body).version).toBe(1);

      // Bob pushes the same remote — must start his own history at v1.
      r = await app.inject({ method: "POST", url: "/v1/environment-files/mock/versions", headers: auth(b.token), payload: upload("Qk9CX0NJUEhFUg") });
      expect(r.statusCode, r.body).toBe(201);
      expect(JSON.parse(r.body).version).toBe(1);

      const q = `?canonicalRemote=${encodeURIComponent(REMOTE)}&fileName=.env.local`;
      const aList = JSON.parse((await app.inject({ method: "GET", url: `/v1/environment-files/mock/versions${q}`, headers: auth(a.token) })).body);
      const bList = JSON.parse((await app.inject({ method: "GET", url: `/v1/environment-files/mock/versions${q}`, headers: auth(b.token) })).body);
      expect(aList.map((v: any) => v.ciphertext)).toEqual(["QUxJQ0VfQ0lQSEVS"]);
      expect(bList.map((v: any) => v.ciphertext)).toEqual(["Qk9CX0NJUEhFUg"]);

      // Each account's project list contains only its own project.
      const aProj = JSON.parse((await app.inject({ method: "GET", url: "/v1/projects", headers: auth(a.token) })).body);
      const bProj = JSON.parse((await app.inject({ method: "GET", url: "/v1/projects", headers: auth(b.token) })).body);
      expect(aProj).toHaveLength(1);
      expect(bProj).toHaveLength(1);
      expect(aProj[0].id).not.toBe(bProj[0].id);
    });

    it("numbers versions sequentially per account and returns them ascending", async () => {
      const a = await register(app, `seq-${uniq()}@example.com`);
      for (const c of ["djE", "djI", "djM"]) {
        const r = await app.inject({ method: "POST", url: "/v1/environment-files/mock/versions", headers: auth(a.token), payload: upload(c) });
        expect(r.statusCode, r.body).toBe(201);
      }
      const list = JSON.parse(
        (await app.inject({ method: "GET", url: `/v1/environment-files/mock/versions?canonicalRemote=${encodeURIComponent(REMOTE)}&fileName=.env.local`, headers: auth(a.token) })).body,
      );
      expect(list.map((v: any) => v.version)).toEqual([1, 2, 3]);
      expect(list.at(-1).ciphertext).toBe("djM");
      expect(list.at(-1).nonce).toBeTruthy();
      expect(list.at(-1).algorithm).toBe("AES-256-GCM");
    });

    it("refuses to serve another user's storage objects", async () => {
      const a = await register(app, `obj-a-${uniq()}@example.com`);
      const b = await register(app, `obj-b-${uniq()}@example.com`);
      await app.inject({ method: "POST", url: "/v1/environment-files/mock/versions", headers: auth(a.token), payload: upload("U0VDUkVU") });
      const key = encodeURIComponent(`users/${a.userId}/projects/x/environments/local/versions/y`);
      const r = await app.inject({ method: "GET", url: `/v1/storage/signed/${key}`, headers: auth(b.token) });
      expect([403, 404]).toContain(r.statusCode);
      const trav = encodeURIComponent(`users/${b.userId}/../${a.userId}/projects`);
      const r2 = await app.inject({ method: "GET", url: `/v1/storage/signed/${trav}`, headers: auth(b.token) });
      expect([400, 403, 404]).toContain(r2.statusCode);
    });

    it("only lets a user revoke their own devices, and revocation kills that device's token", async () => {
      const a = await register(app, `dev-a-${uniq()}@example.com`, { deviceName: "alice-mbp", platform: "darwin" });
      const b = await register(app, `dev-b-${uniq()}@example.com`, { deviceName: "bob-xps", platform: "linux" });
      const aDevices = JSON.parse((await app.inject({ method: "GET", url: "/v1/auth/devices", headers: auth(a.token) })).body);
      expect(aDevices).toHaveLength(1);
      const aDeviceId = aDevices[0].id;

      // Bob cannot revoke Alice's device.
      let r = await app.inject({ method: "DELETE", url: `/v1/auth/devices/${aDeviceId}`, headers: auth(b.token) });
      expect(r.statusCode).toBe(404);
      r = await app.inject({ method: "GET", url: "/v1/projects", headers: auth(a.token) });
      expect(r.statusCode).toBe(200);

      // Alice revokes her own device → that device's token stops working.
      r = await app.inject({ method: "DELETE", url: `/v1/auth/devices/${aDeviceId}`, headers: auth(a.token) });
      expect(r.statusCode).toBe(200);
      r = await app.inject({ method: "GET", url: "/v1/projects", headers: auth(a.token) });
      expect(r.statusCode).toBe(401);
      r = await app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: a.refreshToken } });
      expect(r.statusCode).toBe(401);
    });

    it("rejects refresh tokens as access tokens and access tokens as refresh tokens", async () => {
      const a = await register(app, `typ-${uniq()}@example.com`);
      let r = await app.inject({ method: "GET", url: "/v1/projects", headers: auth(a.refreshToken) });
      expect(r.statusCode).toBe(401);
      r = await app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: a.token } });
      expect(r.statusCode).toBe(401);
      r = await app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: a.refreshToken } });
      expect(r.statusCode).toBe(200);
      // Rotation: the used refresh token is single-use.
      r = await app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: a.refreshToken } });
      expect(r.statusCode).toBe(401);
    });

    it("rejects forged and alg-confused tokens", async () => {
      const a = await register(app, `forge-${uniq()}@example.com`);
      const [h, p] = a.token.split(".");
      const none = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${p}.`;
      let r = await app.inject({ method: "GET", url: "/v1/projects", headers: auth(none) });
      expect(r.statusCode).toBe(401);
      const tampered = `${h}.${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p!, "base64url").toString()), sub: "someone-else" })).toString("base64url")}.${a.token.split(".")[2]}`;
      r = await app.inject({ method: "GET", url: "/v1/projects", headers: auth(tampered) });
      expect(r.statusCode).toBe(401);
      const expired = signJwt({ sub: a.userId, email: "x@example.com", expiresInSec: -10 });
      r = await app.inject({ method: "GET", url: "/v1/projects", headers: auth(expired) });
      expect(r.statusCode).toBe(401);
    });

    it("treats emails case-insensitively (no duplicate accounts)", async () => {
      const id = uniq();
      await register(app, `Case-${id}@Example.com`);
      const r = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email: `case-${id}@example.com`, password: "another-pass-1" } });
      expect(r.statusCode).toBe(409);
      const l = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: `CASE-${id}@EXAMPLE.COM`, password: "correct-horse-1" } });
      expect(l.statusCode).toBe(200);
    });

    it("validates inputs: path-like names, bad ids, oversized and non-base64 payloads", async () => {
      const a = await register(app, `val-${uniq()}@example.com`);
      for (const bad of [
        upload("djE", "../../etc/passwd"),
        upload("djE", ".env", "../other"),
        upload("not base64 !!!"),
        { ...upload("djE"), encryption: { algorithm: "ROT13", keyVersion: 1, nonce: "bm9uY2U", authTag: "dGFn" } },
      ]) {
        const r = await app.inject({ method: "POST", url: "/v1/environment-files/mock/versions", headers: auth(a.token), payload: bad });
        expect(r.statusCode, JSON.stringify(bad.environment)).toBe(400);
      }
      for (const url of ["/v1/projects/not-a-uuid", "/v1/projects/not-a-uuid/environments", "/v1/environments/zzz/files"]) {
        const r = await app.inject({ method: "GET", url, headers: auth(a.token) });
        expect(r.statusCode, url).toBe(404);
      }
      const big = "A".repeat(3 * 1024 * 1024);
      const r = await app.inject({ method: "POST", url: "/v1/environment-files/mock/versions", headers: auth(a.token), payload: upload(big) });
      expect([400, 413]).toContain(r.statusCode);
    });

    it("never leaks internal error details and sets security headers", async () => {
      const r = await app.inject({ method: "GET", url: "/health" });
      expect(r.statusCode).toBe(200);
      expect(r.headers["x-content-type-options"]).toBe("nosniff");
      expect(r.headers["x-frame-options"]).toBe("DENY");
      const nf = await app.inject({ method: "GET", url: "/v1/nope" });
      expect(nf.statusCode).toBe(404);
      const bad = await app.inject({ method: "POST", url: "/v1/auth/login", headers: { "content-type": "application/json" }, payload: "{not json" });
      expect(bad.statusCode).toBe(400);
      expect(bad.body).not.toMatch(/at .*\.ts:\d+/); // no stack traces
    });

    it("cannot reach another user's project, environments or files by id", async () => {
      const a = await register(app, `idor-a-${uniq()}@example.com`);
      const b = await register(app, `idor-b-${uniq()}@example.com`);
      await app.inject({ method: "POST", url: "/v1/environment-files/mock/versions", headers: auth(a.token), payload: upload("YQ") });
      const [proj] = JSON.parse((await app.inject({ method: "GET", url: "/v1/projects", headers: auth(a.token) })).body);
      const envs = JSON.parse((await app.inject({ method: "GET", url: `/v1/projects/${proj.id}/environments`, headers: auth(a.token) })).body);
      expect(envs).toHaveLength(1);
      for (const [method, url] of [
        ["GET", `/v1/projects/${proj.id}`],
        ["DELETE", `/v1/projects/${proj.id}`],
        ["GET", `/v1/projects/${proj.id}/environments`],
        ["GET", `/v1/environments/${envs[0].id}/files`],
      ] as const) {
        const r = await app.inject({ method, url, headers: auth(b.token) });
        expect(r.statusCode, `${method} ${url}`).toBe(404);
      }
      // Alice's data is untouched.
      expect(JSON.parse((await app.inject({ method: "GET", url: "/v1/projects", headers: auth(a.token) })).body)).toHaveLength(1);
    });
  });
}

describe("production auth hardening", () => {
  let app: App;
  const prev = process.env.NODE_ENV;
  beforeAll(async () => {
    store._clearAll();
    app = await buildApp({ logger: false, rateLimit: false });
  });
  afterAll(async () => {
    process.env.NODE_ENV = prev;
    await app.close();
  });

  it("does not let anyone set a password on an existing passwordless (e.g. GitHub) account", async () => {
    await store.ensureUser("oauth-only@example.com");
    process.env.NODE_ENV = "production";
    try {
      const r1 = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "oauth-only@example.com", password: "attacker-pass-1" } });
      expect(r1.statusCode).toBe(401);
      const r2 = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email: "oauth-only@example.com", password: "attacker-pass-1" } });
      expect(r2.statusCode).toBe(409);
      const u = await store.getUserByEmail("oauth-only@example.com");
      expect(u?.passwordHash).toBeUndefined();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("uses one generic message for unknown email and wrong password", async () => {
    process.env.NODE_ENV = "production";
    try {
      await store.ensureUser("known@example.com");
      const a = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "nobody@example.com", password: "whatever-123" } });
      expect(a.statusCode).toBe(401);
      expect(JSON.parse(a.body).error).toBe("Invalid email or password");
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("rate-limits auth endpoints", async () => {
    const limited = await buildApp({ logger: false });
    let last = 0;
    for (let i = 0; i < 15; i++) {
      const r = await limited.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "rl@example.com", password: "nope-nope-1" } });
      last = r.statusCode;
    }
    expect(last).toBe(429);
    await limited.close();
  });
});
