import { Header } from "@/components/Header";
import { RealtimeTaskList } from "@/components/RealtimeTaskList";
import { createServerClient } from "@/lib/supabase";
import type { Project, Task } from "@/lib/database.types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  GitBranch,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  params: Promise<{ id: string }>;
}

async function getProjectWithTasks(
  id: string
): Promise<{ project: Project; tasks: Task[] } | null> {
  const supabase = createServerClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (projectError || !project) {
    return null;
  }

  // Get all tasks for this project, ordered by created_at desc
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  if (tasksError) {
    console.error("Failed to fetch tasks:", tasksError);
  }

  return {
    project: project as Project,
    tasks: (tasks as Task[]) || [],
  };
}

const statusVariants: Record<string, "default" | "secondary"> = {
  active: "default",
  paused: "secondary",
};

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const data = await getProjectWithTasks(id);

  if (!data) {
    notFound();
  }

  const { project, tasks } = data;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8">
          {/* Back button */}
          <div className="mb-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>

          {/* Project header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
              <a
                href={project.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {project.repo_url}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild variant="outline">
                <Link href={`/projects/${id}/chat`}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat
                </Link>
              </Button>
              <Badge variant={statusVariants[project.status] || "secondary"}>
                {project.status.replace("_", " ")}
              </Badge>
            </div>
          </div>

          {/* Epic */}
          {project.current_epic && (
            <Card className="mb-8">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Current Epic
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground">{project.current_epic}</p>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={CheckCircle}
              label="Completed"
              value={project.completed_tasks}
              total={project.total_tasks}
              color="text-green-500"
            />
            <StatCard
              icon={XCircle}
              label="Failed"
              value={project.failed_tasks}
              color="text-destructive"
            />
            <StatCard
              icon={GitBranch}
              label="Branch"
              value={project.integration_branch || project.default_branch}
              mono
            />
            <StatCard
              icon={Clock}
              label="Last Activity"
              value={formatDistanceToNow(new Date(project.last_activity), { addSuffix: true })}
            />
          </div>

          {/* PR Link */}
          {project.pr_url && (
            <Card className="mb-8 border-primary/50 bg-primary/5">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">Pull Request</p>
                  <p className="text-sm text-muted-foreground">
                    PR #{project.pr_number} is ready for review
                  </p>
                </div>
                <Button asChild>
                  <a href={project.pr_url} target="_blank" rel="noopener noreferrer">
                    View PR
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Task History */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Task History</h2>
            <RealtimeTaskList projectId={id} initialTasks={tasks} />
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  total,
  color,
  mono = false,
}: {
  icon: typeof Clock;
  label: string;
  value: string | number;
  total?: number;
  color?: string;
  mono?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`h-5 w-5 shrink-0 ${color || "text-muted-foreground"}`} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`truncate text-lg font-semibold ${mono ? "font-mono text-sm" : ""}`}>
            {value}
            {total !== undefined && (
              <span className="text-sm font-normal text-muted-foreground">/{total}</span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
