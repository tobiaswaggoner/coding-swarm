import { config } from "./config.js";
import { log } from "./logger.js";
import { TaskDatabase } from "./db/supabase.js";
import { createK8sClients } from "./k8s/client.js";
import { reapRunningTasks } from "./engine/reaper.js";
import { spawnPendingTasks } from "./engine/spawner.js";
import { EngineLock } from "./engine/lock.js";

let isShuttingDown = false;
let engineLock: EngineLock | null = null;

/**
 * Main poll loop
 */
async function pollLoop(db: TaskDatabase, k8s: ReturnType<typeof createK8sClients>) {
  while (!isShuttingDown) {
    try {
      // 1. Check running tasks (completion, timeout, failure)
      await reapRunningTasks(db, k8s);

      // 2. Spawn new jobs for pending tasks
      await spawnPendingTasks(db, k8s);
    } catch (err) {
      log.error(`Poll loop error: ${err}`);
      // Continue running, don't crash
    }

    // Wait before next poll
    await sleep(config.pollIntervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Graceful shutdown handler
 */
function setupShutdownHandlers() {
  const shutdown = async (signal: string) => {
    log.info(`Received ${signal}, shutting down gracefully...`);
    isShuttingDown = true;

    // Release lock
    if (engineLock) {
      await engineLock.release();
    }

    // Give poll loop time to finish current iteration
    setTimeout(() => {
      log.info("Shutdown complete");
      process.exit(0);
    }, 2000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

/**
 * Entry point
 */
async function main() {
  log.info("Spawning Engine starting...");
  log.info(`Poll interval: ${config.pollIntervalMs}ms`);
  log.info(`Job timeout: ${config.jobTimeoutMinutes} minutes`);
  log.info(`Max parallel jobs: ${config.maxParallelJobs}`);
  log.info(`Namespace: ${config.jobNamespace}`);

  // Acquire singleton lock
  engineLock = new EngineLock();
  const acquired = await engineLock.acquire();

  if (!acquired) {
    log.error("Failed to acquire lock. Another instance is running. Exiting.");
    process.exit(1);
  }

  setupShutdownHandlers();

  // Initialize clients
  const db = new TaskDatabase();
  const k8s = createK8sClients();

  log.info("Starting poll loop...");
  await pollLoop(db, k8s);
}

main().catch(async (err) => {
  log.error(`Fatal error: ${err}`);
  if (engineLock) {
    await engineLock.release();
  }
  process.exit(1);
});
