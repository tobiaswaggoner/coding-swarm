import type { Project } from "@/lib/database.types";
import Link from "next/link";

interface ProjectCardProps {
  project: Project;
  runningTasks: number;
}

function getStatusIcon(status: Project["status"]): string {
  switch (status) {
    case "active":
      return "🟢";
    case "paused":
      return "⏸️";
    case "awaiting_review":
      return "👀";
    case "completed":
      return "✅";
    case "failed":
      return "🔴";
    default:
      return "💤";
  }
}

function getStatusLabel(status: Project["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "awaiting_review":
      return "Awaiting Review";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
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
  if (!epic) return "—";
  // Extract first meaningful word or phrase (max 15 chars)
  const words = epic.split(/\s+/).slice(0, 3).join(" ");
  return words.length > 15 ? words.slice(0, 15) + "…" : words;
}

export function ProjectCard({ project, runningTasks }: ProjectCardProps) {
  const statusColor =
    project.status === "active"
      ? "border-green-500/30 bg-green-500/5"
      : project.status === "failed"
        ? "border-red-500/30 bg-red-500/5"
        : project.status === "awaiting_review"
          ? "border-yellow-500/30 bg-yellow-500/5"
          : "border-zinc-700 bg-zinc-800/50";

  return (
    <Link
      href={`/projects/${project.id}`}
      className={`block rounded-lg border p-4 transition-all hover:border-zinc-600 hover:bg-zinc-800/80 ${statusColor}`}
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-white">{project.name}</h3>
        <span className="text-lg" title={getStatusLabel(project.status)}>
          {getStatusIcon(project.status)}
        </span>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">Workers:</span>
          <span className="font-medium text-zinc-300">
            {runningTasks > 0 ? (
              <span className="text-green-400">{runningTasks} running</span>
            ) : (
              <span className="text-zinc-500">idle</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-zinc-500">Task:</span>
          <span className="font-medium text-zinc-300">
            {extractKeyword(project.current_epic)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-zinc-500">Progress:</span>
          <span className="font-medium text-zinc-300">
            {project.completed_tasks}/{project.total_tasks} tasks
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-zinc-700/50 pt-3">
        <span className="text-xs text-zinc-500">
          {getTimeAgo(project.last_activity)}
        </span>
        {project.pr_url && (
          <span className="text-xs text-blue-400">PR #{project.pr_number}</span>
        )}
      </div>
    </Link>
  );
}
