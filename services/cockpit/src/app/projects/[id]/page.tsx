import { Header } from "@/components/Header";
import { createServerClient } from "@/lib/supabase";
import type { Project } from "@/lib/database.types";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

async function getProject(id: string): Promise<Project | null> {
  const supabase = createServerClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !project) {
    return null;
  }

  return project as Project;
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-6">
            <Link
              href="/"
              className="text-sm text-zinc-400 transition-colors hover:text-white"
            >
              &larr; Back to Dashboard
            </Link>
          </div>

          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <p className="mt-1 text-sm text-zinc-500">{project.repo_url}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-300">
                {project.status}
              </span>
            </div>
          </div>

          {/* Placeholder for Phase 2 */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-12 text-center">
            <span className="text-4xl">🚧</span>
            <h2 className="mt-4 text-lg font-medium text-white">
              Project Detail View - Coming Soon
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Task history, log visualization, and controls will be implemented
              in Phase 2
            </p>
          </div>

          {/* Basic project info */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoCard
              title="Epic"
              value={project.current_epic || "No epic defined"}
            />
            <InfoCard
              title="Progress"
              value={`${project.completed_tasks}/${project.total_tasks} tasks`}
            />
            <InfoCard
              title="Failed Tasks"
              value={String(project.failed_tasks)}
            />
            <InfoCard
              title="Integration Branch"
              value={project.integration_branch || project.default_branch}
            />
            <InfoCard
              title="Last Activity"
              value={new Date(project.last_activity).toLocaleString()}
            />
            <InfoCard
              title="Created"
              value={new Date(project.created_at).toLocaleString()}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="text-sm font-medium text-zinc-500">{title}</h3>
      <p className="mt-1 text-white">{value}</p>
    </div>
  );
}
