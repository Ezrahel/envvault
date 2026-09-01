import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { normalizeRemote, type GitRepositoryIdentity } from "./normalizeRemote.js";
import type { ProjectIdentity } from "@envvault/shared";

const execFileAsync = promisify(execFile);

export interface GitService {
  findRepositoryRoot(startPath: string): Promise<string | null>;
  getOriginRemote(repositoryRoot: string): Promise<string | null>;
  getIdentity(repositoryRoot: string): Promise<ProjectIdentity | null>;
  getAllRemotes(repositoryRoot: string): Promise<Map<string, string>>;
}

function isGitDirOrFileExists(stat: { isDirectory(): boolean; isFile(): boolean } | null): boolean {
  return !!stat && (stat.isDirectory() || stat.isFile());
}

export async function findGitRoot(startPath: string): Promise<string | null> {
  let current = path.resolve(startPath);
  const root = path.parse(current).root;

  while (true) {
    const gitPath = path.join(current, ".git");
    try {
      const stat = await fs.stat(gitPath);
      if (isGitDirOrFileExists(stat)) {
        // Worktree support: .git may be a file rather than dir
        if (stat.isFile()) {
          try {
            const content = await fs.readFile(gitPath, "utf-8");
            // Validate gitdir reference, but still treat current as worktree root
            // Optionally resolve common dir via git rev-parse --git-common-dir
            if (content.startsWith("gitdir:")) {
              return current;
            }
          } catch {
            // ignore read error, still return current if .git file exists
          }
        }
        return current;
      }
    } catch {
      // not found, continue
    }
    if (current === root) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

export async function resolveGitCommonDir(repositoryRoot: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--git-common-dir"], {
      cwd: repositoryRoot,
    });
    const common = stdout.trim();
    if (!common) return null;
    return path.isAbsolute(common) ? common : path.resolve(repositoryRoot, common);
  } catch {
    return null;
  }
}

export async function getRemotesViaGit(repositoryRoot: string): Promise<Map<string, string>> {
  const remotes = new Map<string, string>();
  try {
    const { stdout } = await execFileAsync("git", ["remote"], { cwd: repositoryRoot });
    const names = stdout
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const name of names) {
      try {
        const { stdout: urlOut } = await execFileAsync("git", ["remote", "get-url", name], {
          cwd: repositoryRoot,
        });
        const url = urlOut.trim();
        if (url) remotes.set(name, url);
      } catch {
        // ignore single remote failure
      }
    }
  } catch {
    // no git or no remotes
  }
  return remotes;
}

export async function getOriginRemoteWithFallback(repositoryRoot: string): Promise<string | null> {
  const remotes = await getRemotesViaGit(repositoryRoot);
  if (remotes.has("origin")) return remotes.get("origin")!;
  if (remotes.has("upstream")) return remotes.get("upstream")!;
  // return first if any
  for (const v of remotes.values()) return v;
  return null;
}

export interface AmbiguousRemotes {
  type: "ambiguous";
  remotes: Map<string, string>;
}

export async function getPreferredRemote(
  repositoryRoot: string,
): Promise<string | null | AmbiguousRemotes> {
  const remotes = await getRemotesViaGit(repositoryRoot);
  if (remotes.size === 0) return null;
  if (remotes.size === 1) return [...remotes.values()][0]!;
  // Prefer origin
  if (remotes.has("origin") && remotes.size === 1) return remotes.get("origin")!;
  if (remotes.has("origin") && remotes.size > 1) {
    // If origin exists but also other distinct canonical remotes, flag ambiguity
    const originCanonical = (() => {
      try {
        return normalizeRemote(remotes.get("origin")!).canonicalRemote;
      } catch {
        return remotes.get("origin")!;
      }
    })();
    const distinct = new Set<string>();
    for (const url of remotes.values()) {
      try {
        distinct.add(normalizeRemote(url).canonicalRemote);
      } catch {
        distinct.add(url);
      }
    }
    if (distinct.size > 1) {
      return { type: "ambiguous", remotes };
    }
    return remotes.get("origin")!;
  }
  // No origin, but multiple remotes distinct -> ambiguous
  if (remotes.size > 1) return { type: "ambiguous", remotes };
  return [...remotes.values()][0]!;
}

export async function getIdentityFromPath(startPath: string): Promise<ProjectIdentity | null> {
  const root = await findGitRoot(startPath);
  if (!root) return null;
  const remote = await getOriginRemoteWithFallback(root);
  if (!remote) return null;
  try {
    return normalizeRemote(remote);
  } catch {
    return null;
  }
}

export function createGitService(): GitService {
  return {
    findRepositoryRoot: findGitRoot,
    getOriginRemote: getOriginRemoteWithFallback,
    getIdentity: async (repositoryRoot: string) => {
      const remote = await getOriginRemoteWithFallback(repositoryRoot);
      if (!remote) return null;
      try {
        return normalizeRemote(remote);
      } catch {
        return null;
      }
    },
    getAllRemotes: getRemotesViaGit,
  };
}

// Also export low-level for testing
export { normalizeRemote };
export type { GitRepositoryIdentity };
