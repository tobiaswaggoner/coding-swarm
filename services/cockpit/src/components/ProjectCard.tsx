import type { Project } from "@/lib/database.types";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProjectCardProps {
  project: Project;
  runningTasks: number;
}

function getStatusVariant(status: Project["status"]): "default" | "secondary" {
  return status === "active" ? "default" : "secondary";
}

function getStatusLabel(status: Project["status"]): string {
  return status === "active" ? "Active" : "Paused";
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function extractKeyword(epic: string | null): string {
  if (!epic) return "No task";
  const words = epic.split(/\s+/).slice(0, 3).join(" ");
  return words.length > 20 ? words.slice(0, 20) + "..." : words;
}

export function ProjectCard({ project, runningTasks }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg leading-tight">{project.name}</CardTitle>
            <Badge variant={getStatusVariant(project.status)}>
              {getStatusLabel(project.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Workers</span>
              <span className={runningTasks > 0 ? "font-medium text-primary" : "text-muted-foreground"}>
                {runningTasks > 0 ? `${runningTasks} running` : "idle"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Task</span>
              <span className="font-medium text-foreground truncate max-w-[140px]">
                {extractKeyword(project.current_epic)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium text-foreground">
                {project.completed_tasks}/{project.total_tasks}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">
              {getTimeAgo(project.last_activity)}
            </span>
            {project.pr_url && (
              <Badge variant="outline" className="text-xs">
                PR #{project.pr_number}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
