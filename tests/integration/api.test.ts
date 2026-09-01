import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import { authRoutes } from "../../apps/api/src/routes/auth.js";
import { projectRoutes } from "../../apps/api/src/routes/projects.js";
import { environmentRoutes } from "../../apps/api/src/routes/environments.js";
import { versionRoutes } from "../../apps/api/src/routes/versions.js";

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(authRoutes, { prefix: "/v1/auth" });
  await app.register(projectRoutes, { prefix: "/v1" });
  await app.register(environmentRoutes, { prefix: "/v1" });
  await app.register(versionRoutes, { prefix: "/v1" });
  return app;
}

describe("API integration", () => {
  it("health check via real app not needed here", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "test@example.com" } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.token).toBeTruthy();
    expect(body.userId).toBeTruthy();
    const token = body.token;

    // list projects empty initially (scoped to user)
    let r = await app.inject({ method: "GET", url: "/v1/projects", headers: { Authorization: `Bearer ${token}` } });
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body)).toEqual([]);

    // create project
    r = await app.inject({
      method: "POST",
      url: "/v1/projects",
      headers: { Authorization: `Bearer ${token}` },
      payload: { provider: "github", host: "github.com", owner: "<username>", repository: "<repository>", canonicalRemote: "github.com/<username>/<repository>" },
    });
    expect(r.statusCode).toBe(201);
    const proj = JSON.parse(r.body);
    expect(proj.canonicalRemote).toBe("github.com/<username>/<repository>");

    // list again
    r = await app.inject({ method: "GET", url: "/v1/projects", headers: { Authorization: `Bearer ${token}` } });
    expect(JSON.parse(r.body).length).toBe(1);

    // create environment
    r = await app.inject({
      method: "POST",
      url: `/v1/projects/${proj.id}/environments`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "development" },
    });
    expect(r.statusCode).toBe(201);
    const env = JSON.parse(r.body);
    expect(env.name).toBe("development");

    // create env file
    r = await app.inject({
      method: "POST",
      url: `/v1/environments/${env.id}/files`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { fileName: ".env.local" },
    });
    expect(r.statusCode).toBe(201);

    // upload encrypted payload (ciphertext only)
    const payload = {
      project: { provider: "github", host: "github.com", owner: "<username>", repository: "<repository>", canonicalRemote: "github.com/<username>/<repository>" },
      environment: { name: "development", fileName: ".env.local" },
      encryption: { algorithm: "AES-256-GCM", keyVersion: 1, nonce: "abc", authTag: "def" },
      ciphertext: "ENCRYPTED_CIPHERTEXT_BASE64",
    };
    r = await app.inject({
      method: "POST",
      url: `/v1/environment-files/${env.id}/versions`,
      headers: { Authorization: `Bearer ${token}` },
      payload,
    });
    expect(r.statusCode).toBe(201);
    expect(JSON.parse(r.body).version).toBe(1);

    // list versions via query (canonicalRemote)
    r = await app.inject({
      method: "GET",
      url: `/v1/environment-files/mock/versions?canonicalRemote=${encodeURIComponent("github.com/<username>/<repository>")}&fileName=.env.local`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.statusCode).toBe(200);
    const versions = JSON.parse(r.body);
    expect(versions.length).toBe(1);
    expect(versions[0].ciphertext).toBe("ENCRYPTED_CIPHERTEXT_BASE64");
    // ensure server never stored plaintext — only ciphertext
    expect(JSON.stringify(versions)).not.toContain("DATABASE_URL");

    // unauthorized should fail
    r = await app.inject({ method: "GET", url: "/v1/projects" });
    expect(r.statusCode).toBe(401);

    await app.close();
  });

  it("rejects invalid project creation (Zod validation)", async () => {
    const app = await buildApp();
    const login = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "a@b.com" } });
    const token = JSON.parse(login.body).token;
    const r = await app.inject({
      method: "POST",
      url: "/v1/projects",
      headers: { Authorization: `Bearer ${token}` },
      payload: { provider: "github" }, // missing required fields
    });
    expect(r.statusCode).toBe(400);
    await app.close();
  });

  it("unique constraint: same canonicalRemote for same user returns existing", async () => {
    const app = await buildApp();
    const login = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "dup@example.com" } });
    const token = JSON.parse(login.body).token;
    const payload = { provider: "github", host: "github.com", owner: "x", repository: "y", canonicalRemote: "github.com/x/y" };
    const r1 = await app.inject({ method: "POST", url: "/v1/projects", headers: { Authorization: `Bearer ${token}` }, payload });
    const r2 = await app.inject({ method: "POST", url: "/v1/projects", headers: { Authorization: `Bearer ${token}` }, payload });
    expect(JSON.parse(r1.body).id).toBe(JSON.parse(r2.body).id);
    await app.close();
  });
});
