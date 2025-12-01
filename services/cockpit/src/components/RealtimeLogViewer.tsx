"use client";

import { useRealtimeTaskLog, useRealtimeTask } from "@/hooks/useRealtimeTasks";
import { LogViewer } from "./LogViewer";
import { Task } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";
import {
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import type { TaskStatus } from "@/lib/database.types";

interface RealtimeLogViewerProps {
  taskId: string;
  initialLog: string | null;
  initialTask: Task;
}

const statusConfig: Record<
  TaskStatus,
  { icon: typeof Clock; label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { icon: Clock, label: "Pending", variant: "secondary" },
  running: { icon: Loader2, label: "Running", variant: "default" },
  completed: { icon: CheckCircle, label: "Completed", variant: "outline" },
  failed: { icon: XCircle, label: "Failed", variant: "destructive" },
};

export function RealtimeLogViewer({
  taskId,
  initialLog,
  initialTask,
}: RealtimeLogViewerProps) {
  const { log, isConnected: logConnected } = useRealtimeTaskLog(taskId, initialLog);
  const { task, isConnected: taskConnected } = useRealtimeTask(initialTask);

  const isConnected = logConnected && taskConnected;
  const statusInfo = statusConfig[task.status];
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-4">
      {/* Live status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={statusInfo.variant} className="gap-1">
            <StatusIcon
              className={`h-3 w-3 ${task.status === "running" ? "animate-spin" : ""}`}
            />
            {statusInfo.label}
          </Badge>
          {task.status === "running" && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Task is running...
            </span>
          )}
        </div>
        <Badge variant={isConnected ? "outline" : "secondary"} className="gap-1 text-xs">
          {isConnected ? (
            <>
              <Wifi className="h-3 w-3 text-green-500" />
              Live
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              Connecting...
            </>
          )}
        </Badge>
      </div>

      {/* Log viewer - execution only */}
      {log ? (
        <LogViewer jsonlContent={log} />
      ) : (
        <div className="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {task.status === "pending"
              ? "Logs will appear once the task starts"
              : task.status === "running"
                ? "Waiting for logs..."
                : "No logs available"}
          </p>
        </div>
      )}
    </div>
  );
}
