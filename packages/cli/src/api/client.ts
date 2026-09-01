import { loadConfig } from "@envvault/config";
import { ApiClient } from "@envvault/sdk";
import { loadAuth } from "../auth/store.js";

export async function getApiClient(): Promise<ApiClient> {
  const cfg = await loadConfig();
  const auth = await loadAuth();
  const baseUrl = process.env.ENVVAULT_API_URL ?? cfg.apiUrl ?? "http://localhost:3001";
  if (process.env.DEBUG) console.log(`[debug] ApiClient baseUrl=${baseUrl} token=${auth?.token ? auth.token.slice(0,12)+"..." : "none"}`);
  return new ApiClient({
    baseUrl,
    token: auth?.token,
  });
}
