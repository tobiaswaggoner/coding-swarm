"use client";

import { Task, TaskStatus, TaskType } from "@/lib/database.types";
import { getAgentType, agentBorderColors } from "@/lib/agent-utils";
import Link from "next/link";
import {
  Code,
  GitMerge,
  Eye,
  Wrench,
  GitPullRequest,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TaskCardProps {
  task: Task;
  projectId: string;
}

const statusConfig: Record<
  TaskStatus,
  { icon: typeof Clock; color: string }
> = {
  pending: { icon: Clock, color: "text-muted-foreground" },
  running: { icon: Loader2, color: "text-primary" },
  completed: { icon: CheckCircle, color: "text-green-500" },
  failed: { icon: XCircle, color: "text-destructive" },
};

const taskTypeConfig: Record<TaskType, { icon: typeof Code; color: string }> = {
  CODE: { icon: Code, color: "text-blue-500" },
  MERGE: { icon: GitMerge, color: "text-purple-500" },
  REVIEW: { icon: Eye, color: "text-yellow-500" },
  FIX: { icon: Wrench, color: "text-orange-500" },
  PR: { icon: GitPullRequest, color: "text-green-500" },
  VALIDATE: { icon: CheckCircle, color: "text-cyan-500" },
};

export function TaskCard({ task, projectId }: TaskCardProps) {
  const statusInfo = statusConfig[task.status];
  const StatusIcon = statusInfo.icon;
  const typeInfo = task.task_type ? taskTypeConfig[task.task_type] : null;
  const TypeIcon = typeInfo?.icon || Code;
  const agentType = getAgentType(task.addressee);
  const borderColor = agentBorderColors[agentType];

  // Truncate prompt for preview
  const promptPreview = task.prompt.length > 80 ? task.prompt.substring(0, 80) + "..." : task.prompt;

  const timeAgo = task.completed_at
    ? formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })
    : task.started_at
      ? formatDistanceToNow(new Date(task.started_at), { addSuffix: true })
      : formatDistanceToNow(new Date(task.created_at), { addSuffix: true });

  return (
    <Link
      href={`/projects/${projectId}/tasks/${task.id}`}
      className={`flex items-center gap-3 px-2 py-1.5 rounded-r hover:bg-accent/50 transition-colors group border-l-2 ${borderColor}`}
    >
      {/* Status icon */}
      <StatusIcon
        className={`h-3.5 w-3.5 shrink-0 ${statusInfo.color} ${task.status === "running" ? "animate-spin" : ""}`}
      />

      {/* Task type */}
      <TypeIcon className={`h-3.5 w-3.5 shrink-0 ${typeInfo?.color || "text-muted-foreground"}`} />

      {/* Prompt preview */}
      <span className="flex-1 truncate text-xs text-foreground">
        {promptPreview}
      </span>

      {/* Branch (if exists) */}
      {task.branch && (
        <span className="hidden sm:block truncate max-w-32 text-[11px] text-muted-foreground/60 font-mono">
          {task.branch.split("/").pop()}
        </span>
      )}

      {/* Time */}
      <span className="shrink-0 text-[11px] text-muted-foreground/60">
        {timeAgo.replace(" ago", "").replace("about ", "")}
      </span>

      {/* Chevron */}
      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground" />
    </Link>
  );
}
