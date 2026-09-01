import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ENV_CLASSIFICATION, IGNORED_ENV_FILES, DEFAULT_IGNORE_DIRS } from "@envvault/shared";
import type { EnvironmentFile, ProjectIdentity, ScanOptions } from "@envvault/shared";
import { findGitRoot, getOriginRemoteWithFallback } from "@envvault/git";
import { normalizeRemote } from "@envvault/git";

export function classifyEnvironment(fileName: string, customMap?: Record<string, string>): string {
  if (customMap && customMap[fileName]) return customMap[fileName]!;
  return ENV_CLASSIFICATION[fileName] ?? "custom";
}

export function isEnvFile(fileName: string, includeExamples = false): boolean {
  if (IGNORED_ENV_FILES.has(fileName) && !includeExamples) return false;
  // Must match .env* pattern
  if (fileName === ".env") return true;
  if (fileName.startsWith(".env.")) return true;
  return false;
}

export function shouldIgnoreDir(dirName: string, customIgnore?: Set<string>): boolean {
  if (DEFAULT_IGNORE_DIRS.has(dirName)) return true;
  if (customIgnore?.has(dirName)) return true;
  return false;
}

export interface DiscoveredFile {
  absolutePath: string;
  fileName: string;
  environmentName: string;
  project: ProjectIdentity | null;
  gitRoot: string | null;
}

export async function* scanRoots(
  roots: string[],
  options: ScanOptions = {}
): AsyncIterable<DiscoveredFile> {
  const ignoreDirs = new Set<string>([...DEFAULT_IGNORE_DIRS, ...(options.ignoreDirs ?? [])]);
  const followSymlinks = options.followSymlinks ?? false;
  const maxDepth = options.maxDepth ?? 12;

  for (const root of roots) {
    const expanded = root.replace(/^~(?=$|\/|\\)/, process.env.HOME ?? "");
    const resolved = path.resolve(expanded);
    const visited = new Set<string>();
    yield* walkDir(resolved, 0, maxDepth, ignoreDirs, followSymlinks, visited);
  }
}

async function* walkDir(
  dir: string,
  depth: number,
  maxDepth: number,
  ignoreDirs: Set<string>,
  followSymlinks: boolean,
  visited: Set<string>,
): AsyncIterable<DiscoveredFile> {
  if (depth > maxDepth) return;
  // Prevent symlink loops via realpath tracking
  try {
    const real = await fs.realpath(dir);
    if (visited.has(real)) return;
    visited.add(real);
  } catch {
    // ignore realpath errors
  }
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e: unknown) {
    const msg = (e as Error)?.message ?? "";
    const code = (e as NodeJS.ErrnoException)?.code;
    if (msg.toLowerCase().includes("permission denied") || code === "EACCES" || code === "EPERM") {
      // Caller can log: Skipped <dir> Reason: permission denied (per spec §20)
      return;
    }
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Handle symlinks
    if (entry.isSymbolicLink() && !followSymlinks) continue;

    let statEntry = entry;
    if (entry.isSymbolicLink() && followSymlinks) {
      try {
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          if (shouldIgnoreDir(entry.name, ignoreDirs)) continue;
          yield* walkDir(fullPath, depth + 1, maxDepth, ignoreDirs, followSymlinks, visited);
          continue;
        } else if (stats.isFile()) {
          // treat as file below
          statEntry = { ...entry, isFile: () => true, isDirectory: () => false } as unknown as typeof entry;
        }
      } catch {
        continue;
      }
    }

    if (statEntry.isDirectory()) {
      if (shouldIgnoreDir(entry.name, ignoreDirs)) continue;
      yield* walkDir(fullPath, depth + 1, maxDepth, ignoreDirs, followSymlinks, visited);
    } else if (statEntry.isFile()) {
      if (!isEnvFile(entry.name)) continue;
      // Classify
      const envName = classifyEnvironment(entry.name);
      // Find project identity
      let project: ProjectIdentity | null = null;
      let gitRoot: string | null = null;
      try {
        gitRoot = await findGitRoot(dir);
        if (gitRoot) {
          const remote = await getOriginRemoteWithFallback(gitRoot);
          if (remote) {
            try {
              project = normalizeRemote(remote);
            } catch {
              project = null;
            }
          }
        }
      } catch {
        // ignore
      }

      yield {
        absolutePath: fullPath,
        fileName: entry.name,
        environmentName: envName,
        project,
        gitRoot,
      };
    }
  }
}

// Convenience helper to collect
export async function scan(roots: string[], options?: ScanOptions): Promise<DiscoveredFile[]> {
  const out: DiscoveredFile[] = [];
  for await (const f of scanRoots(roots, options)) out.push(f);
  return out;
}

// Parser helpers: we do not need to parse values for discovery, but provide utility
export function parseEnvContent(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // strip quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) map.set(key, val);
  }
  return map;
}
