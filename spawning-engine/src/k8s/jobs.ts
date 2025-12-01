import * as k8s from "@kubernetes/client-node";
import { K8sClients } from "./client.js";
import { Task, Project } from "../db/supabase.js";
import { config } from "../config.js";

export interface JobStatus {
  exists: boolean;
  active: boolean;
  succeeded: boolean;
  failed: boolean;
}

/**
 * Check if task is for a project manager (Green agent)
 */
export function isProjectManager(task: Task): boolean {
  return task.addressee.startsWith("project-mgr-");
}

/**
 * Generate unique job name from task ID
 */
export function generateJobName(task: Task): string {
  const prefix = isProjectManager(task) ? "green-agent" : "red-agent";
  return `${prefix}-${task.id.slice(0, 8)}`;
}

/**
 * Create environment variables for a Red agent job
 */
function buildRedAgentEnv(task: Task): k8s.V1EnvVar[] {
  return [
    { name: "TASK_PROMPT", value: task.prompt },
    ...(task.repo_url ? [{ name: "REPO_URL", value: task.repo_url }] : []),
    ...(task.branch ? [{ name: "BRANCH", value: task.branch }] : []),
    { name: "OUTPUT_FORMAT", value: "stream-json" },
  ];
}

/**
 * Create environment variables for a Green agent job
 */
function buildGreenAgentEnv(task: Task, project: Project | null): k8s.V1EnvVar[] {
  const env: k8s.V1EnvVar[] = [
    { name: "TASK_PROMPT", value: task.prompt },
    { name: "OUTPUT_FORMAT", value: "stream-json" },
  ];

  // Project ID is required for Green
  if (task.project_id) {
    env.push({ name: "PROJECT_ID", value: task.project_id });
  }

  // Repository info
  const repoUrl = task.repo_url || project?.repo_url;
  if (repoUrl) {
    env.push({ name: "REPO_URL", value: repoUrl });
  }

  // Branch: prefer task branch, then integration branch, then default
  const branch = task.branch || project?.integration_branch || project?.default_branch || "main";
  env.push({ name: "BRANCH", value: branch });

  // Integration branch (for creating step branches from)
  if (project?.integration_branch) {
    env.push({ name: "INTEGRATION_BRANCH", value: project.integration_branch });
  }

  // Trigger context
  if (task.triggered_by_task_id) {
    env.push({ name: "TRIGGERED_BY_TASK_ID", value: task.triggered_by_task_id });
  }

  return env;
}

/**
 * Create a K8s Job for a task
 * Supports both Red (worker) and Green (project manager) agents
 */
export async function createJob(
  clients: K8sClients,
  task: Task,
  jobName: string,
  project?: Project | null
): Promise<void> {
  const isManager = isProjectManager(task);
  const agentType = isManager ? "green" : "red";
  const image = isManager ? config.greenAgentImage : config.jobImage;

  // Build environment variables based on agent type
  const env = isManager
    ? buildGreenAgentEnv(task, project || null)
    : buildRedAgentEnv(task);

  // Green agents need access to both coding-swarm-secrets AND spawning-engine-secrets
  const envFrom: k8s.V1EnvFromSource[] = [
    { secretRef: { name: "coding-swarm-secrets" } },
  ];
  if (isManager) {
    envFrom.push({ secretRef: { name: "spawning-engine-secrets" } });
  }

  const job: k8s.V1Job = {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      name: jobName,
      namespace: config.jobNamespace,
      labels: {
        app: "coding-swarm-agent",
        "agent-type": agentType,
        "task-id": task.id,
        addressee: task.addressee.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 63),
        ...(task.project_id ? { "project-id": task.project_id.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 63) } : {}),
      },
    },
    spec: {
      ttlSecondsAfterFinished: 300,
      backoffLimit: 0,
      template: {
        metadata: {
          labels: {
            app: "coding-swarm-agent",
            "agent-type": agentType,
            "task-id": task.id,
          },
        },
        spec: {
          restartPolicy: "Never",
          securityContext: {
            runAsUser: 1000,
            runAsNonRoot: true,
          },
          containers: [
            {
              name: "agent",
              image: image,
              env: env,
              envFrom: envFrom,
              resources: {
                requests: { memory: "256Mi", cpu: "100m" },
                limits: { memory: "2Gi", cpu: "1000m" },
              },
            },
          ],
        },
      },
    },
  };

  await clients.batchApi.createNamespacedJob(config.jobNamespace, job);
}

/**
 * Get job status
 */
export async function getJobStatus(
  clients: K8sClients,
  jobName: string
): Promise<JobStatus> {
  try {
    const response = await clients.batchApi.readNamespacedJob(
      jobName,
      config.jobNamespace
    );
    const status = response.body.status;

    return {
      exists: true,
      active: (status?.active || 0) > 0,
      succeeded: (status?.succeeded || 0) > 0,
      failed: (status?.failed || 0) > 0,
    };
  } catch (err: unknown) {
    const error = err as { response?: { statusCode?: number } };
    if (error.response?.statusCode === 404) {
      return { exists: false, active: false, succeeded: false, failed: false };
    }
    throw err;
  }
}

/**
 * Delete a job (and its pods)
 */
export async function deleteJob(
  clients: K8sClients,
  jobName: string
): Promise<void> {
  try {
    await clients.batchApi.deleteNamespacedJob(
      jobName,
      config.jobNamespace,
      undefined,
      undefined,
      undefined,
      undefined,
      "Background" // Delete pods in background
    );
  } catch (err: unknown) {
    const error = err as { response?: { statusCode?: number } };
    if (error.response?.statusCode === 404) {
      return; // Already deleted
    }
    throw err;
  }
}
