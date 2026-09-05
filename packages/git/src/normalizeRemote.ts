import type { GitProvider, ProjectIdentity } from "@envvault/shared";

export interface GitRepositoryIdentity extends ProjectIdentity {}

function detectProvider(host: string): GitProvider {
  const h = host.toLowerCase();
  if (h === "github.com" || h.endsWith(".github.com")) return "github";
  if (h === "gitlab.com" || h.endsWith(".gitlab.com")) return "gitlab";
  if (h === "bitbucket.org" || h.endsWith(".bitbucket.org")) return "bitbucket";
  return "unknown";
}

/**
 * Normalize a git remote URL to canonical form: host/owner/repo (no .git, no protocol, no user).
 *
 * Examples:
 *   git@github.com:<username>/<repository>.git -> github.com/<username>/<repository>
 *   ssh://git@github.com/<username>/<repository>.git -> same
 *   https://github.com/<username>/<repository>.git -> same
 *   https://github.com/<username>/<repository> -> same
 *   git@gitlab.com:group/subgroup/project.git -> gitlab.com/group/subgroup/project
 */
export function normalizeRemote(raw: string): GitRepositoryIdentity {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Empty remote URL");

  let host = "";
  let pathPart = "";

  // SCP-like syntax: git@host:owner/repo.git  or user@host:path
  // Must NOT match URLs with scheme like https://, ssh://, git://
  const scpMatch = trimmed.match(/^([^@]+@)?([^:/]+):(.+)$/);
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);

  if (scpMatch && !hasScheme && !trimmed.startsWith("ssh://") && !trimmed.includes("://")) {
    // scp form e.g. git@github.com:owner/repo.git  or github.com:owner/repo
    host = scpMatch[2] ?? "";
    pathPart = scpMatch[3] ?? "";
  } else {
    // URL form
    let urlStr = trimmed;
    if (!hasScheme) {
      // e.g. github.com:owner/repo or github.com/owner/repo  (no scheme)
      const slashIdx = urlStr.indexOf("/");
      const colonIdx = urlStr.indexOf(":");
      if (colonIdx !== -1 && (slashIdx === -1 || colonIdx < slashIdx)) {
        // colon as separator like github.com:owner/repo
        host = urlStr.slice(0, colonIdx);
        pathPart = urlStr.slice(colonIdx + 1);
      } else if (slashIdx !== -1) {
        host = urlStr.slice(0, slashIdx);
        pathPart = urlStr.slice(slashIdx + 1);
      } else {
        throw new Error(`Cannot parse remote URL: ${raw}`);
      }
    } else {
      try {
        const u = new URL(urlStr);
        host = u.hostname;
        // pathname starts with /, strip — port is ignored via hostname (not host)
        pathPart = u.pathname.replace(/^\//, "");
      } catch {
        throw new Error(`Cannot parse remote URL: ${raw}`);
      }
    }
  }

  if (!host) throw new Error(`Cannot extract host from remote: ${raw}`);
  host = host.toLowerCase();

  // Strip trailing slash, .git suffix
  pathPart = pathPart.replace(/\/+$/, "");
  if (pathPart.toLowerCase().endsWith(".git")) {
    pathPart = pathPart.slice(0, -4);
  }
  // Remove leading slashes
  pathPart = pathPart.replace(/^\/+/, "");
  // Remove trailing slash again
  pathPart = pathPart.replace(/\/+$/, "");

  if (!pathPart) throw new Error(`Cannot extract path from remote: ${raw}`);

  // Split path into parts — decode percent-encoding from URL parsing
  // (e.g. https://github.com/<username>/<repository> becomes %3C...%3E via URL)
  const parts = pathPart
    .split("/")
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
  if (parts.length === 0) throw new Error(`Empty repository path: ${raw}`);

  const repository = parts[parts.length - 1]!;
  const owner = parts.length >= 2 ? parts.slice(0, -1).join("/") : undefined;

  const canonicalUrl = owner ? `${host}/${owner}/${repository}` : `${host}/${repository}`;
  const provider = detectProvider(host);

  return {
    provider,
    host,
    owner,
    repository,
    canonicalRemote: canonicalUrl,
    canonicalUrl,
  } as GitRepositoryIdentity & { canonicalUrl: string };
}

// Backwards compat alias
export function normalizeGitRemote(remote: string): ProjectIdentity {
  const r = normalizeRemote(remote);
  return {
    provider: r.provider,
    host: r.host,
    owner: r.owner,
    repository: r.repository,
    canonicalRemote: r.canonicalRemote,
  };
}
