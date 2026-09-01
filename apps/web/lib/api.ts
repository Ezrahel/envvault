export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface Project {
  id: string;
  provider: string;
  host: string;
  owner?: string;
  repository: string;
  canonicalRemote: string;
  createdAt: string;
  updatedAt: string;
}

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  name: string;
  platform?: string;
  lastSeenAt?: string;
  createdAt: string;
  revokedAt?: string | null;
}

export async function fetchProjects(token?: string): Promise<Project[]> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_URL}/v1/projects`, { headers, cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as Project[];
  } catch {
    return [];
  }
}

export async function fetchEnvironments(projectId: string, token?: string): Promise<Environment[]> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_URL}/v1/projects/${projectId}/environments`, { headers, cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as Environment[];
  } catch {
    return [];
  }
}

export async function fetchDevices(token?: string): Promise<Device[]> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_URL}/v1/auth/devices`, { headers, cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as Device[];
  } catch {
    return [];
  }
}
