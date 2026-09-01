import { describe, it, expect } from "vitest";
import { normalizeRemote } from "./normalizeRemote.js";

describe("normalizeRemote", () => {
  const cases: Array<[string, string, string, string, string]> = [
    ["git@github.com:<username>/<repository>.git", "github.com", "<username>", "<repository>", "github.com/<username>/<repository>"],
    ["ssh://git@github.com/<username>/<repository>.git", "github.com", "<username>", "<repository>", "github.com/<username>/<repository>"],
    ["https://github.com/<username>/<repository>.git", "github.com", "<username>", "<repository>", "github.com/<username>/<repository>"],
    ["https://github.com/<username>/<repository>", "github.com", "<username>", "<repository>", "github.com/<username>/<repository>"],
    ["https://github.com/<username>/<repository>/", "github.com", "<username>", "<repository>", "github.com/<username>/<repository>"],
    ["git@gitlab.com:group/subgroup/project.git", "gitlab.com", "group/subgroup", "project", "gitlab.com/group/subgroup/project"],
    ["https://gitlab.com/group/subgroup/project.git", "gitlab.com", "group/subgroup", "project", "gitlab.com/group/subgroup/project"],
    ["git@bitbucket.org:team/repo.git", "bitbucket.org", "team", "repo", "bitbucket.org/team/repo"],
    ["https://bitbucket.org/team/repo.git", "bitbucket.org", "team", "repo", "bitbucket.org/team/repo"],
    ["ssh://git@github.com:2222/<username>/<repository>.git", "github.com", "<username>", "<repository>", "github.com/<username>/<repository>"],
    // Additional edge cases per spec 9-10
    ["https://github.com/<username>/<repository>.git/", "github.com", "<username>", "<repository>", "github.com/<username>/<repository>"],
    ["git@github.com:<username>/<repository>", "github.com", "<username>", "<repository>", "github.com/<username>/<repository>"],
    ["ssh://git@github.com/<username>/<repository>", "github.com", "<username>", "<repository>", "github.com/<username>/<repository>"],
    ["https://gitlab.com/a/b/c/d.git", "gitlab.com", "a/b/c", "d", "gitlab.com/a/b/c/d"],
    ["git@git.company.com:group/project.git", "git.company.com", "group", "project", "git.company.com/group/project"],
    ["https://github.com:443/<username>/<repository>.git", "github.com", "<username>", "<repository>", "github.com/<username>/<repository>"],
    ["git://github.com/<username>/<repository>.git", "github.com", "<username>", "<repository>", "github.com/<username>/<repository>"],
  ];

  for (const [input, host, owner, repo, canonical] of cases) {
    it(`normalizes ${input} -> ${canonical}`, () => {
      const r = normalizeRemote(input);
      expect(r.host).toBe(host);
      expect(r.owner).toBe(owner);
      expect(r.repository).toBe(repo);
      expect(r.canonicalRemote).toBe(canonical);
    });
  }

  it("detects provider github", () => {
    expect(normalizeRemote("git@github.com:foo/bar.git").provider).toBe("github");
  });
  it("detects provider gitlab", () => {
    expect(normalizeRemote("git@gitlab.com:foo/bar.git").provider).toBe("gitlab");
  });
  it("detects provider bitbucket", () => {
    expect(normalizeRemote("git@bitbucket.org:foo/bar.git").provider).toBe("bitbucket");
  });
  it("detects provider unknown for self-hosted", () => {
    expect(normalizeRemote("git@mygit.example.com:foo/bar.git").provider).toBe("unknown");
    expect(normalizeRemote("https://git.company.com/team/repo.git").provider).toBe("unknown");
  });

  it("throws on empty", () => {
    expect(() => normalizeRemote("")).toThrow();
  });

  it("strips .git and trailing slash", () => {
    expect(normalizeRemote("https://github.com/a/b.git/").canonicalRemote).toBe("github.com/a/b");
  });

  it("preserves owner path with subgroups", () => {
    expect(normalizeRemote("https://gitlab.com/a/b/c/d.git").canonicalRemote).toBe("gitlab.com/a/b/c/d");
  });

  it("fork handling: different owners are different identities", () => {
    const a = normalizeRemote("git@github.com:<username>/<repository>.git");
    const b = normalizeRemote("git@github.com:john/<repository>.git");
    expect(a.canonicalRemote).not.toBe(b.canonicalRemote);
    expect(a.canonicalRemote).toBe("github.com/<username>/<repository>");
    expect(b.canonicalRemote).toBe("github.com/john/<repository>");
  });

  it("local username and folder not part of identity", () => {
    // Same remote from different local paths must map to same canonical
    const r1 = normalizeRemote("git@github.com:<username>/<repository>.git");
    const r2 = normalizeRemote("https://github.com/<username>/<repository>.git");
    expect(r1.canonicalRemote).toBe(r2.canonicalRemote);
  });

  it("remote URL change is new identity unless linked", () => {
    const old = normalizeRemote("git@github.com:<username>/<repository>.git");
    const nw = normalizeRemote("git@github.com:company/<repository>.git");
    expect(old.canonicalRemote).not.toBe(nw.canonicalRemote);
  });

  it("case insensitive host", () => {
    expect(normalizeRemote("git@GitHub.com:Foo/Bar.git").host).toBe("github.com");
    expect(normalizeRemote("https://GITHUB.COM/foo/bar").host).toBe("github.com");
  });
});
