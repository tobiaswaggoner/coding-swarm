"use client";

import { useRealtimeTask } from "@/hooks/useRealtimeTasks";
import { MarkdownContent } from "./LogViewer";
import { Task, TaskResult } from "@/lib/database.types";
import {
  CheckCircle,
  XCircle,
  DollarSign,
  Clock,
  ExternalLink,
} from "lucide-react";

interface ResultCardProps {
  initialTask: Task;
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function ResultCard({ initialTask }: ResultCardProps) {
  const { task } = useRealtimeTask(initialTask);
  const result = task.result;

  if (!result) {
    if (task.status === "running") {
      return (
        <div className="text-sm text-muted-foreground animate-pulse">
          Task is running...
        </div>
      );
    }
    if (task.status === "pending") {
      return (
        <div className="text-sm text-muted-foreground">
          Waiting to start...
        </div>
      );
    }
    return (
      <div className="text-sm text-muted-foreground">
        No result available
      </div>
    );
  }

  const isSuccess = result.success;

  return (
    <div className={`rounded-lg p-4 ${isSuccess ? "bg-green-500/10" : "bg-destructive/10"}`}>
      {/* Status indicator */}
      <div className="flex items-center gap-2 mb-3">
        {isSuccess ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
        <span className={`text-sm font-medium ${isSuccess ? "text-green-500" : "text-destructive"}`}>
          {isSuccess ? "Success" : "Failed"}
        </span>
      </div>

      {/* Summary as Markdown */}
      {result.summary && (
        <MarkdownContent content={result.summary} />
      )}

      {/* Stats */}
      <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-border/50">
        {result.cost_usd !== undefined && (
          <div className="flex items-center gap-1 text-xs">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Cost:</span>
            <span className="font-medium">{formatCost(result.cost_usd)}</span>
          </div>
        )}
        {result.duration_ms !== undefined && (
          <div className="flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Duration:</span>
            <span className="font-medium">{formatDuration(result.duration_ms)}</span>
          </div>
        )}
        {result.pr_url && (
          <a
            href={result.pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            View Pull Request
          </a>
        )}
      </div>
    </div>
  );
}
