import { fetchProjects } from "../../lib/api";
import { ProjectsTable } from "@/components/projects-table";

export default async function ProjectsPage() {
  const projects = await fetchProjects();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-400">{projects.length} projects</span>
      </div>
      <p className="max-w-[640px] text-sm text-zinc-400">
        Projects are identified by <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-xs">canonical Git remote</code>, not local folder name. The same repo cloned as <code className="bg-zinc-900 px-1 rounded font-mono text-xs">/home/john/{'<'}repository{'>'}</code> or <code className="bg-zinc-900 px-1 rounded font-mono text-xs">D:\Work\pdf</code> maps to <code className="bg-zinc-900 px-1 rounded font-mono text-xs">github.com/{'<'}username{'>'}/{'<'}repository{'>'}</code>.
      </p>
      <ProjectsTable projects={projects} />
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 text-xs text-zinc-500">
        <span className="font-medium text-zinc-300">Security note</span> — Dashboard shows metadata only. Secret values are never displayed and never leave the client in plaintext. Use <code className="bg-zinc-900 px-1 rounded">envvault pull</code> to restore.
      </div>
    </div>
  );
}
