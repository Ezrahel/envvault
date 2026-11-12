import { fetchProjects } from "@/lib/api";
import { ProjectsTable } from "@/components/projects-table";
import { PageHeader, Code, Note } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

export default async function ProjectsPage() {
  const projects = await fetchProjects();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Projects"
        title="Projects"
        description={
          <>
            Identified by <Code>canonical Git remote</Code>, not folder name. The same repo cloned to <Code>/home/john/web</Code> or{" "}
            <Code>D:\Work\web</Code> maps to <Code>github.com/acme/web</Code>.
          </>
        }
        actions={<Badge>{projects.length} projects</Badge>}
      />
      <ProjectsTable projects={projects} />
      <Note tone="volt">
        <span className="font-medium text-white">Security note:</span> the dashboard shows metadata only. Secret values are never displayed and
        never leave the client in plaintext. Use <Code>envvault pull</Code> to restore.
      </Note>
    </div>
  );
}
