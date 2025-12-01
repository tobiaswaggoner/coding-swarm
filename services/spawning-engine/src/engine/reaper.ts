import { TaskDatabase, Task, TaskResult } from "../db/supabase.js";
import { K8sClients } from "../k8s/client.js";
import { getJobStatus, deleteJob } from "../k8s/jobs.js";
import { getJobLogs, parseJsonlResult } from "../k8s/logs.js";
import { config } from "../config.js";
import { log } from "../logger.js";

/**
 * Build the manager wakeup prompt with context about the completed task
 */
function buildManagerPrompt(completedTask: Task): string {
  const result: TaskResult = completedTask.result || { success: false, summary: "" };

  const lines = [
    "MANAGER_WAKEUP: Ein Worker-Task wurde abgeschlossen.",
    "",
    "## Abgeschlossener Task",
    "",
    `- **Task-ID:** ${completedTask.id}`,
    `- **Task-Typ:** ${completedTask.task_type || "UNKNOWN"}`,
    `- **Status:** ${result.success ? "ERFOLG" : "FEHLGESCHLAGEN"}`,
    `- **Branch:** ${result.branch || completedTask.branch || "N/A"}`,
  ];

  if (result.duration_ms) {
    lines.push(`- **Dauer:** ${Math.round(result.duration_ms / 1000)}s`);
  }

  lines.push("");
  lines.push("## Task-Ergebnis");
  lines.push("");
  lines.push(result.summary || "Keine Zusammenfassung verfügbar.");

  if (result.pr_url) {
    lines.push("");
    lines.push(`**Pull Request:** ${result.pr_url}`);
  }

  if (result.conflicts) {
    lines.push("");
    lines.push("**Hinweis:** Merge hatte Konflikte, die gelöst wurden.");
  }

  if (result.decision) {
    lines.push("");
    lines.push(`**Review-Entscheidung:** ${result.decision}`);
    if (result.issues && result.issues.length > 0) {
      lines.push("**Issues:**");
      for (const issue of result.issues) {
        lines.push(`- ${issue}`);
      }
    }
  }

  lines.push("");
  lines.push("## Deine Aufgabe");
  lines.push("");
  lines.push("1. Lies den aktuellen Plan aus `.ai/plan.md`");
  lines.push("2. Analysiere das Ergebnis des abgeschlossenen Tasks");
  lines.push("3. Entscheide über nächste Aktion:");
  lines.push("   - CODE-Task erfolgreich → MERGE-Task erstellen");
  lines.push("   - MERGE-Task erfolgreich → Nächsten CODE-Task erstellen");
  lines.push("   - REVIEW mit APPROVE → MERGE-Task erstellen");
  lines.push("   - REVIEW mit REQUEST_CHANGES → FIX-Task erstellen");
  lines.push("   - Alle Schritte fertig → PR-Task erstellen");
  lines.push("4. Aktualisiere den Plan entsprechend");
  lines.push("5. Erstelle den nächsten Task");
  lines.push("");
  lines.push("WICHTIG: Du führst selbst KEINE Git-Operationen aus (außer für .ai/plan.md). Alles läuft über Red-Tasks.");

  return lines.join("\n");
}

/**
 * Trigger the project manager after a worker task completes
 */
async function triggerProjectManager(
  db: TaskDatabase,
  completedTask: Task
): Promise<void> {
  if (!completedTask.project_id) {
    log.debug(`Task ${completedTask.id} has no project_id, skipping manager trigger`);
    return;
  }

  // Only trigger for worker tasks (not for manager tasks)
  if (!completedTask.addressee.startsWith("worker-")) {
    log.debug(`Task ${completedTask.id} is not a worker task, skipping manager trigger`);
    return;
  }

  const managerAddressee = `project-mgr-${completedTask.project_id}`;

  // Idempotency: don't trigger if manager already has pending/running task
  if (await db.hasRunningOrPendingTask(managerAddressee)) {
    log.debug(`Manager ${managerAddressee} already queued, skipping trigger`);
    return;
  }

  // Get project info
  const project = await db.getProject(completedTask.project_id);
  if (!project) {
    log.warn(`Project ${completedTask.project_id} not found, skipping manager trigger`);
    return;
  }

  // Don't trigger for paused projects
  if (project.status === "paused") {
    log.debug(`Project ${completedTask.project_id} is paused, skipping manager trigger`);
    return;
  }

  // Build manager prompt with context
  const prompt = buildManagerPrompt(completedTask);

  // Create manager task
  await db.createTask({
    addressee: managerAddressee,
    project_id: completedTask.project_id,
    prompt: prompt,
    repo_url: project.repo_url,
    branch: project.integration_branch || project.default_branch,
    triggered_by_task_id: completedTask.id,
    created_by: "spawning-engine",
  });

  log.info(`Triggered manager for project: ${completedTask.project_id}`);
}

/**
 * Handle task completion: update stats and trigger manager
 */
async function handleTaskCompletion(
  db: TaskDatabase,
  task: Task,
  result: TaskResult,
  logs: string
): Promise<boolean> {
  // Update task status (atomic)
  const updated = await db.completeTask(task.id, result);
  if (!updated) {
    log.debug(`Task ${task.id} already processed by another instance`);
    return false;
  }

  log.info(`Task ${task.id} completed successfully`);

  // Save logs
  if (logs) {
    await db.saveTaskLogs(task.id, logs);
  }

  // Update project stats
  if (task.project_id) {
    await db.incrementProjectStats(task.project_id, result.success);
  }

  // Trigger project manager (for worker tasks)
  // Reload task to get the result we just saved
  const completedTask = await db.getTask(task.id);
  if (completedTask) {
    await triggerProjectManager(db, completedTask);
  }

  return true;
}

/**
 * Handle task failure: update stats and trigger manager
 */
async function handleTaskFailure(
  db: TaskDatabase,
  task: Task,
  result: TaskResult,
  logs: string
): Promise<boolean> {
  // Update task status (atomic)
  const updated = await db.failTask(task.id, result);
  if (!updated) {
    log.debug(`Task ${task.id} already processed by another instance`);
    return false;
  }

  log.warn(`Task ${task.id} failed`);

  // Save logs
  if (logs) {
    await db.saveTaskLogs(task.id, logs);
  }

  // Update project stats
  if (task.project_id) {
    await db.incrementProjectStats(task.project_id, false);
  }

  // Trigger project manager (for worker tasks) - even on failure
  const completedTask = await db.getTask(task.id);
  if (completedTask) {
    await triggerProjectManager(db, completedTask);
  }

  return true;
}

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

      // Handle completion with manager trigger
      await handleTaskCompletion(db, task, result, logs);
      continue;
    }

    if (status.failed) {
      const logs = await getJobLogs(k8s, jobName);
      const result = parseJsonlResult(logs);

      // Handle failure with manager trigger
      await handleTaskFailure(db, task, { ...result, success: false }, logs);
      continue;
    }

    // Still running, nothing to do
    log.debug(`Task ${task.id} still running`);
  }
}
