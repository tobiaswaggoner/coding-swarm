import * as k8s from "@kubernetes/client-node";
import { K8sClients } from "./client.js";
import { Task } from "../db/supabase.js";
import { config } from "../config.js";

export interface JobStatus {
  exists: boolean;
  active: boolean;
  succeeded: boolean;
  failed: boolean;
}

/**
 * Generate unique job name from task ID
 */
export function generateJobName(taskId: string): string {
  return `red-agent-${taskId.slice(0, 8)}`;
}

/**
 * Create a K8s Job for a task
 */
export async function createJob(
  clients: K8sClients,
  task: Task,
  jobName: string
): Promise<void> {
  const job: k8s.V1Job = {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      name: jobName,
      namespace: config.jobNamespace,
      labels: {
        app: "coding-swarm-agent",
        "task-id": task.id,
        addressee: task.addressee.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 63),
      },
    },
    spec: {
      ttlSecondsAfterFinished: 300,
      backoffLimit: 0,
      template: {
        metadata: {
          labels: {
            app: "coding-swarm-agent",
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
              image: config.jobImage,
              env: [
                { name: "TASK_PROMPT", value: task.prompt },
                ...(task.repo_url ? [{ name: "REPO_URL", value: task.repo_url }] : []),
                ...(task.branch ? [{ name: "BRANCH", value: task.branch }] : []),
                { name: "OUTPUT_FORMAT", value: "stream-json" },
              ],
              envFrom: [
                {
                  secretRef: {
                    name: "coding-swarm-secrets",
                  },
                },
              ],
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
