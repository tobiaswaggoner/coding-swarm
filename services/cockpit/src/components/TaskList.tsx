"use client";

import { Task } from "@/lib/database.types";
import { TaskCard } from "./TaskCard";

interface TaskListProps {
  tasks: Task[];
  projectId: string;
}

export function TaskList({ tasks, projectId }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
        <p className="text-sm text-muted-foreground">No tasks yet</p>
      </div>
    );
  }

  // Group tasks by status for better overview
  const runningTasks = tasks.filter((t) => t.status === "running");
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const failedTasks = tasks.filter((t) => t.status === "failed");

  return (
    <div className="space-y-6">
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
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">
        {title} ({tasks.length})
      </h3>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} projectId={projectId} />
        ))}
      </div>
    </div>
  );
}
