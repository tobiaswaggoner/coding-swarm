import { TaskDatabase, Task } from "../db/supabase.js";
import { K8sClients } from "../k8s/client.js";
import { getJobStatus, deleteJob } from "../k8s/jobs.js";
import { getJobLogs, parseJsonlResult } from "../k8s/logs.js";
import { config } from "../config.js";
import { log } from "../logger.js";

/**
 * Check if a task has exceeded its timeout
 */
function isTimedOut(task: Task): boolean {
  if (!task.started_at) return false;

  const startedAt = new Date(task.started_at).getTime();
  const now = Date.now();
  const timeoutMs = config.jobTimeoutMinutes * 60 * 1000;

  return now - startedAt > timeoutMs;
}

/**
 * Process running tasks: check completion, timeout, failure
 */
export async function reapRunningTasks(
  db: TaskDatabase,
  k8s: K8sClients
): Promise<void> {
  const runningTasks = await db.getRunningTasks();

  for (const task of runningTasks) {
    const jobName = task.worker_pod;
    if (!jobName) {
      log.warn(`Task ${task.id} has no worker_pod, marking as failed`);
      await db.failTask(task.id, {
        success: false,
        summary: "No worker_pod assigned",
      });
      continue;
    }

    // Check timeout first
    if (isTimedOut(task)) {
      log.warn(`Task ${task.id} timed out after ${config.jobTimeoutMinutes} minutes`);
      await deleteJob(k8s, jobName);
      await db.failTask(task.id, {
        success: false,
        summary: `Timeout after ${config.jobTimeoutMinutes} minutes`,
      });
      continue;
    }

    // Check job status
    const status = await getJobStatus(k8s, jobName);

    if (!status.exists) {
      // Job disappeared (manual deletion or TTL cleanup)
      log.warn(`Job ${jobName} for task ${task.id} no longer exists`);
      await db.failTask(task.id, {
        success: false,
        summary: "Job disappeared unexpectedly",
      });
      continue;
    }

    if (status.succeeded) {
      const logs = await getJobLogs(k8s, jobName);
      const result = parseJsonlResult(logs);

      // Atomic update: only proceeds if task is still running
      const updated = await db.completeTask(task.id, result);
      if (updated) {
        log.info(`Task ${task.id} completed successfully`);
        if (logs) {
          await db.saveTaskLogs(task.id, logs);
        }
      } else {
        log.debug(`Task ${task.id} already processed by another instance`);
      }
      continue;
    }

    if (status.failed) {
      const logs = await getJobLogs(k8s, jobName);
      const result = parseJsonlResult(logs);

      // Atomic update: only proceeds if task is still running
      const updated = await db.failTask(task.id, { ...result, success: false });
      if (updated) {
        log.warn(`Task ${task.id} failed`);
        if (logs) {
          await db.saveTaskLogs(task.id, logs);
        }
      } else {
        log.debug(`Task ${task.id} already processed by another instance`);
      }
      continue;
    }

    // Still running, nothing to do
    log.debug(`Task ${task.id} still running`);
  }
}
