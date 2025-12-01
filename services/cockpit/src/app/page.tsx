import { Header } from "@/components/Header";
import { ProjectCard } from "@/components/ProjectCard";
import { SystemStatus } from "@/components/SystemStatus";
import { createServerClient } from "@/lib/supabase";
import type { Project, EngineLock } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getProjects(): Promise<Project[]> {
  const supabase = createServerClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .order("last_activity", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
    return [];
  }

  return (projects as Project[]) || [];
}

async function getRunningTasksByProject(): Promise<Record<string, number>> {
  const supabase = createServerClient();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("status", "running");

  if (error) {
    console.error("Error fetching running tasks:", error);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const task of (tasks as { project_id: string | null }[]) || []) {
    if (task.project_id) {
      counts[task.project_id] = (counts[task.project_id] || 0) + 1;
    }
  }

  return counts;
}

async function getSystemStatus() {
  const supabase = createServerClient();

  // Get running tasks count
  const { count: runningPods, error: tasksError } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("status", "running");

  // Get total concurrent limit (we'll use 10 as default)
  const totalPods = 10;

  // Get engine lock status
  const { data: engineLockData, error: lockError } = await supabase
    .from("engine_lock")
    .select("*")
    .eq("id", 1)
    .single();

  const engineLock = engineLockData as EngineLock | null;
  const engineHealthy = !lockError && !!engineLock?.holder_id;
  const engineLastHeartbeat = engineLock?.last_heartbeat || null;

  // Supabase is healthy if we got here without errors
  const supabaseHealthy = !tasksError && !lockError;

  return {
    runningPods: runningPods || 0,
    totalPods,
    engineHealthy,
    engineLastHeartbeat,
    supabaseHealthy,
  };
}

export default async function Dashboard() {
  const [projects, runningTasksByProject, systemStatus] = await Promise.all([
    getProjects(),
    getRunningTasksByProject(),
    getSystemStatus(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Projects</h1>
            <div className="text-sm text-muted-foreground">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-lg border border-border bg-card/50 p-12 text-center">
              <span className="text-4xl">📭</span>
              <h2 className="mt-4 text-lg font-medium text-foreground">
                No projects yet
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Projects will appear here once created via the Blue Agent or API
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  runningTasks={runningTasksByProject[project.id] || 0}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <SystemStatus {...systemStatus} />
    </div>
  );
}
