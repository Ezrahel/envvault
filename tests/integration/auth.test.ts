import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import { authRoutes } from "../../apps/api/src/routes/auth.js";
import { projectRoutes } from "../../apps/api/src/routes/projects.js";
import { store } from "../../apps/api/src/lib/store.js";

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(authRoutes, { prefix: "/v1/auth" });
  await app.register(projectRoutes, { prefix: "/v1" });
  return app;
}

describe("Auth (JWT + passwords)", () => {
  beforeEach(() => {
    store._clearAll();
  });

  it("register issues a signed JWT that authenticates", async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "jwt@example.com", password: "supersecret1" },
    });
    expect(r.statusCode).toBe(201);
    const body = JSON.parse(r.body);
    expect(body.token.split(".").length).toBe(3);
    expect(body.refreshToken.split(".").length).toBe(3);

    const me = await app.inject({
      method: "GET",
      url: "/v1/projects",
      headers: { Authorization: `Bearer ${body.token}` },
    });
    expect(me.statusCode).toBe(200);
    await app.close();
  });

  it("rejects wrong password and missing password on protected accounts", async () => {
    const app = await buildApp();
    await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "pw@example.com", password: "supersecret1" },
    });
    const bad = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "pw@example.com", password: "wrongpassword" },
    });
    expect(bad.statusCode).toBe(401);
    const missing = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "pw@example.com" },
    });
    expect(missing.statusCode).toBe(401);
    const ok = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "pw@example.com", password: "supersecret1" },
    });
    expect(ok.statusCode).toBe(200);
    await app.close();
  });

  it("legacy email-only login still works outside production (CLI/tests compat)", async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "legacy@example.com" },
    });
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body).token).toBeTruthy();
    await app.close();
  });

  it("rejects tampered tokens", async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "tamper@example.com", password: "supersecret1" },
    });
    const { token } = JSON.parse(r.body);
    const tampered = token.slice(0, -2) + (token.endsWith("Aa") ? "Bb" : "Aa");
    const me = await app.inject({
      method: "GET",
      url: "/v1/projects",
      headers: { Authorization: `Bearer ${tampered}` },
    });
    expect(me.statusCode).toBe(401);
    await app.close();
  });

  it("refresh rotates tokens and logout revokes", async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "rotate@example.com", password: "supersecret1" },
    });
    const { token, refreshToken } = JSON.parse(r.body);

    const ref = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken },
    });
    expect(ref.statusCode).toBe(200);
    const pair2 = JSON.parse(ref.body);

    // Old refresh token is single-use
    const reuse = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken },
    });
    expect(reuse.statusCode).toBe(401);

    // New access token works
    const me = await app.inject({
      method: "GET",
      url: "/v1/projects",
      headers: { Authorization: `Bearer ${pair2.token}` },
    });
    expect(me.statusCode).toBe(200);

    // Logout revokes the access token
    const out = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: { Authorization: `Bearer ${pair2.token}` },
    });
    expect(out.statusCode).toBe(200);
    const after = await app.inject({
      method: "GET",
      url: "/v1/projects",
      headers: { Authorization: `Bearer ${pair2.token}` },
    });
    expect(after.statusCode).toBe(401);

    // Original access token from registration still valid (independent jti)
    const orig = await app.inject({
      method: "GET",
      url: "/v1/projects",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(orig.statusCode).toBe(200);
    await app.close();
  });

  it("does not create duplicate accounts on re-register", async () => {
    const app = await buildApp();
    await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "dup@example.com", password: "supersecret1" },
    });
    const r2 = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "dup@example.com", password: "anothersecret" },
    });
    expect(r2.statusCode).toBe(409);
    await app.close();
  });
});
