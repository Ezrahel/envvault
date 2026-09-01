// Placeholder for OS keychain integration.
// In production, use keytar or similar.
// For MVP, we delegate to auth/store file fallback with warning.

export async function storeSecret(_service: string, _account: string, _secret: string): Promise<void> {
  // TODO: integrate keytar
  // fall back to file store handled in auth/store.ts
}

export async function getSecret(_service: string, _account: string): Promise<string | null> {
  return null;
}

export async function deleteSecret(_service: string, _account: string): Promise<void> {}
