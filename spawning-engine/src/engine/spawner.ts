import { TaskDatabase } from "../db/supabase.js";
import { K8sClients } from "../k8s/client.js";
import { createJob, generateJobName } from "../k8s/jobs.js";
import { config } from "../config.js";
import { log } from "../logger.js";

/**
 * Spawn new jobs for pending tasks (respecting concurrency limits)
 */
export async function spawnPendingTasks(
  db: TaskDatabase,
  k8s: K8sClients
): Promise<void> {
  // Check current running count
  const runningCount = await db.countRunningTasks();

  if (runningCount >= config.maxParallelJobs) {
    log.debug(
      `Max parallel jobs reached (${runningCount}/${config.maxParallelJobs}), skipping spawn`
    );
    return;
  }

  const availableSlots = config.maxParallelJobs - runningCount;

  // Get pending tasks (one per addressee)
  const pendingTasks = await db.getPendingTasksPerAddressee();

  let spawned = 0;
  for (const task of pendingTasks) {
    if (spawned >= availableSlots) {
      log.debug(`Available slots exhausted (${availableSlots}), stopping spawn`);
      break;
    }

    // Double-check addressee doesn't have running task
    const hasRunning = await db.hasRunningTask(task.addressee);
    if (hasRunning) {
      log.debug(`Addressee ${task.addressee} already has running task, skipping`);
      continue;
    }

    const jobName = generateJobName(task.id);

    // Claim task in DB first (atomic)
    const claimed = await db.claimTask(task.id, jobName);
    if (!claimed) {
      log.debug(`Task ${task.id} was claimed by another process, skipping`);
      continue;
    }

    // Create K8s job
    try {
      await createJob(k8s, task, jobName);
      log.info(
        `Spawned job ${jobName} for task ${task.id} (addressee: ${task.addressee})`
      );
      spawned++;
    } catch (err) {
      // Failed to create job, revert task status
      const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
      log.error(`Failed to create job for task ${task.id}: ${errorMsg}`);

      await db.failTask(task.id, {
        success: false,
        summary: `Failed to create K8s job: ${err}`,
      });

      // Also save the error as a log entry
      await db.saveTaskLogs(task.id, JSON.stringify({
        type: "spawn_error",
        timestamp: new Date().toISOString(),
        error: errorMsg,
      }));
    }
  }

  if (spawned > 0) {
    log.info(`Spawned ${spawned} new job(s)`);
  }
}
