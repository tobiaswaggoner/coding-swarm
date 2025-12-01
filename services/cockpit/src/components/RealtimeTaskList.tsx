"use client";

import { Task } from "@/lib/database.types";
import { TaskCard } from "./TaskCard";
import { useRealtimeTasks } from "@/hooks/useRealtimeTasks";
import { Wifi, WifiOff } from "lucide-react";

interface RealtimeTaskListProps {
  projectId: string;
  initialTasks: Task[];
}

export function RealtimeTaskList({ projectId, initialTasks }: RealtimeTaskListProps) {
  const { tasks, isConnected } = useRealtimeTasks({ projectId, initialTasks });

  if (tasks.length === 0) {
    return (
      <div className="rounded border border-dashed border-muted-foreground/25 p-6 text-center">
        <p className="text-xs text-muted-foreground">No tasks yet</p>
      </div>
    );
  }

  // Group tasks by status for better overview
  const runningTasks = tasks.filter((t) => t.status === "running");
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const failedTasks = tasks.filter((t) => t.status === "failed");

  return (
    <div className="space-y-3">
      {/* Connection status - inline */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
        {isConnected ? (
          <Wifi className="h-3 w-3 text-green-500/70" />
        ) : (
          <WifiOff className="h-3 w-3" />
        )}
        <span>{isConnected ? "Live" : "Connecting..."}</span>
      </div>

      {/* Running tasks */}
      {runningTasks.length > 0 && (
        <TaskSection title="Running" tasks={runningTasks} projectId={projectId} />
      )}

      {/* Pending tasks */}
      {pendingTasks.length > 0 && (
        <TaskSection title="Pending" tasks={pendingTasks} projectId={projectId} />
      )}

      {/* Failed tasks */}
      {failedTasks.length > 0 && (
        <TaskSection title="Failed" tasks={failedTasks} projectId={projectId} />
      )}

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <TaskSection title="Completed" tasks={completedTasks} projectId={projectId} />
      )}
    </div>
  );
}

function TaskSection({
  title,
  tasks,
  projectId,
}: {
  title: string;
  tasks: Task[];
  projectId: string;
}) {
  return (
    <div>
      <h3 className="mb-1 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">
        {title} ({tasks.length})
      </h3>
      <div className="space-y-1 rounded-r border-y border-r border-muted/50 bg-muted/20 py-1 pr-1">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} projectId={projectId} />
        ))}
      </div>
    </div>
  );
}
