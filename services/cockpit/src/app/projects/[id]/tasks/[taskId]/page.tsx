import { Header } from "@/components/Header";
import { RealtimeLogViewer } from "@/components/RealtimeLogViewer";
import { ResultCard } from "@/components/ResultCard";
import { CollapsibleCard } from "@/components/CollapsibleCard";
import { MarkdownContent } from "@/components/LogViewer";
import { getAgentType, AgentType } from "@/lib/agent-utils";
import { createServerClient } from "@/lib/supabase";
import type { Task, TaskLog, Project } from "@/lib/database.types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Code,
  GitMerge,
  Eye,
  Wrench,
  GitPullRequest,
  CheckCircle,
  Clock,
  Loader2,
  GitBranch,
  Cpu,
  FolderKanban,
  Bot,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { TaskType } from "@/lib/database.types";

// Agent display configuration
const agentDisplayConfig: Record<AgentType, {
  label: string;
  description: string;
  icon: typeof Cpu;
  bgClass: string;
  textClass: string;
}> = {
  red: {
    label: "Coding Agent",
    description: "Worker executing code tasks",
    icon: Cpu,
    bgClass: "bg-red-600 dark:bg-red-700",
    textClass: "text-white",
  },
  green: {
    label: "Project Manager",
    description: "Planning and orchestration",
    icon: FolderKanban,
    bgClass: "bg-green-600 dark:bg-green-700",
    textClass: "text-white",
  },
  blue: {
    label: "Executive Assistant",
    description: "Strategic planning and communication",
    icon: Bot,
    bgClass: "bg-blue-600 dark:bg-blue-700",
    textClass: "text-white",
  },
};

interface Props {
  params: Promise<{ id: string; taskId: string }>;
}

const taskTypeConfig: Record<TaskType, { icon: typeof Code; label: string; color: string }> = {
  CODE: { icon: Code, label: "Code", color: "text-blue-500" },
  MERGE: { icon: GitMerge, label: "Merge", color: "text-purple-500" },
  REVIEW: { icon: Eye, label: "Review", color: "text-yellow-500" },
  FIX: { icon: Wrench, label: "Fix", color: "text-orange-500" },
  PR: { icon: GitPullRequest, label: "PR", color: "text-green-500" },
  VALIDATE: { icon: CheckCircle, label: "Validate", color: "text-cyan-500" },
};

async function getTaskWithLogs(
  taskId: string
): Promise<{ task: Task; logs: TaskLog | null; project: Project | null } | null> {
  const supabase = createServerClient();

  const { data: taskData, error: taskError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (taskError || !taskData) {
    return null;
  }

  const task = taskData as Task;

  // Get logs
  const { data: logsData } = await supabase
    .from("task_logs")
    .select("*")
    .eq("task_id", taskId)
    .single();

  // Get project if available
  let project: Project | null = null;
  if (task.project_id) {
    const { data: projectData } = await supabase
      .from("projects")
      .select("*")
      .eq("id", task.project_id)
      .single();
    project = projectData as Project | null;
  }

  return {
    task,
    logs: logsData ? (logsData as TaskLog) : null,
    project,
  };
}

export default async function TaskDetailPage({ params }: Props) {
  const { id: projectId, taskId } = await params;
  const data = await getTaskWithLogs(taskId);

  if (!data) {
    notFound();
  }

  const { task, logs, project } = data;
  const typeInfo = task.task_type ? taskTypeConfig[task.task_type] : null;
  const TypeIcon = typeInfo?.icon;
  const agentType = getAgentType(task.addressee);
  const agentInfo = agentDisplayConfig[agentType];
  const AgentIcon = agentInfo.icon;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Agent Type Banner - Full width, prominent */}
        <div className={`${agentInfo.bgClass} ${agentInfo.textClass}`}>
          <div className="mx-auto max-w-7xl px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20">
                  <AgentIcon className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">{agentInfo.label}</h1>
                  <p className="text-sm opacity-90">{agentInfo.description}</p>
                </div>
              </div>
              {/* Task Type Badge */}
              {typeInfo && (
                <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2">
                  {TypeIcon && <TypeIcon className="h-4 w-4" />}
                  <span className="text-sm font-medium">{typeInfo.label} Task</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6">
          {/* Back button */}
          <div className="mb-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/projects/${projectId}`} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to {project?.name || "Project"}
              </Link>
            </Button>
          </div>

          {/* Task info cards */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {task.branch && (
              <InfoCard
                icon={GitBranch}
                title="Branch"
                value={task.branch}
                mono
              />
            )}
            <InfoCard
              icon={Clock}
              title="Created"
              value={formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
            />
            {task.started_at && (
              <InfoCard
                icon={Loader2}
                title="Started"
                value={formatDistanceToNow(new Date(task.started_at), { addSuffix: true })}
              />
            )}
            {task.completed_at && (
              <InfoCard
                icon={CheckCircle}
                title="Completed"
                value={formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}
              />
            )}
          </div>

          {/* Task Prompt */}
          <div className="mb-4">
            <CollapsibleCard title="Task Prompt" defaultExpanded={true}>
              <MarkdownContent content={task.prompt} />
            </CollapsibleCard>
          </div>

          {/* Result */}
          <div className="mb-4">
            <CollapsibleCard title="Result" defaultExpanded={true}>
              <ResultCard initialTask={task} />
            </CollapsibleCard>
          </div>

          {/* Execution Logs */}
          <CollapsibleCard
            title="Execution"
            subtitle={logs?.log_size_bytes ? `Log size: ${(logs.log_size_bytes / 1024).toFixed(1)} KB` : undefined}
            defaultExpanded={false}
          >
            <RealtimeLogViewer
              taskId={taskId}
              initialLog={logs?.jsonl_content || null}
              initialTask={task}
            />
          </CollapsibleCard>
        </div>
      </main>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  value,
  mono = false,
}: {
  icon: typeof Clock;
  title: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className={`truncate text-sm ${mono ? "font-mono" : ""}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
