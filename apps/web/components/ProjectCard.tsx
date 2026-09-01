"use client";

export function ProjectCard({ project }: { project: { canonicalRemote: string; provider: string; id: string; repository: string; createdAt: string; host: string; owner?: string } }) {
  const providerColor = project.provider === "github" ? "#fff" : project.provider === "gitlab" ? "#fc6d26" : project.provider === "bitbucket" ? "#0052cc" : "#888";
  return (
    <div style={{ border: "1px solid #222", borderRadius: 10, background: "#111", padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: providerColor, display: "inline-block" }} />
          <span style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 14 }}>{project.canonicalRemote}</span>
        </div>
        <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
          {project.host} • {project.provider} • ID {project.id.slice(0, 8)} • {new Date(project.createdAt).toLocaleDateString()}
        </div>
      </div>
      <div style={{ color: "#888", fontSize: 12, border: "1px solid #333", padding: "6px 10px", borderRadius: 6, background: "#0a0a0a" }}>
        Encrypted
      </div>
    </div>
  );
}
