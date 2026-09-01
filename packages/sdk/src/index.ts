import type { EncryptedPayload, ProjectIdentity } from "@envvault/shared";

export interface ApiClientOptions {
  baseUrl: string;
  token?: string | undefined;
  fetch?: typeof fetch | undefined;
}

export class ApiClient {
  private baseUrl: string;
  private token: string | undefined;
  private f: typeof fetch;

  constructor(opts: ApiClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.token = opts.token as string | undefined;
    this.f = (opts.fetch ?? fetch) as typeof fetch;
  }

  setToken(token: string | undefined) {
    this.token = token;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  async login(email: string, _password?: string): Promise<{ token: string; userId: string }> {
    // Mock for MVP – in production would call /v1/auth/login with OAuth etc.
    const res = await this.f(`${this.baseUrl}/v1/auth/login`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error(`login failed: ${res.status}`);
    return res.json() as Promise<{ token: string; userId: string }>;
  }

  async listProjects(): Promise<Array<{ id: string; canonicalRemote: string; provider: string }>> {
    const res = await this.f(`${this.baseUrl}/v1/projects`, { headers: this.headers() });
    if (!res.ok) throw new Error(`listProjects failed: ${res.status}`);
    return res.json() as Promise<any>;
  }

  async createProject(identity: ProjectIdentity): Promise<{ id: string }> {
    const res = await this.f(`${this.baseUrl}/v1/projects`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ provider: identity.provider, host: identity.host, owner: identity.owner, repository: identity.repository, canonicalRemote: identity.canonicalRemote }),
    });
    if (!res.ok) throw new Error(`createProject failed: ${res.status}`);
    return res.json() as Promise<any>;
  }

  async uploadEnvFile(params: {
    project: ProjectIdentity;
    environment: { name: string; fileName: string };
    encryption: { algorithm: string; keyVersion: number; nonce: string; authTag?: string | undefined };
    ciphertext: string;
  }): Promise<{ version: number }> {
    const res = await this.f(`${this.baseUrl}/v1/environment-files/mock/versions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`upload failed: ${res.status}`);
    return res.json() as Promise<any>;
  }

  async listVersions(canonicalRemote: string, fileName: string): Promise<EncryptedPayload[]> {
    const res = await this.f(`${this.baseUrl}/v1/environment-files/mock/versions?canonicalRemote=${encodeURIComponent(canonicalRemote)}&fileName=${encodeURIComponent(fileName)}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`listVersions failed: ${res.status}`);
    return res.json() as Promise<any>;
  }
}

export type { EncryptedPayload };
