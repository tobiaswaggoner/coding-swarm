import { TaskDatabase, TaskType } from "../db/supabase.js";
import { PlanStep } from "../plan/types.js";
import { config } from "../config.js";
import { log } from "../logger.js";
import {
  buildCodeTaskPrompt,
  buildMergeTaskPrompt,
  buildReviewTaskPrompt,
  buildFixTaskPrompt,
  buildPRTaskPrompt,
  buildValidateTaskPrompt,
} from "./prompts.js";

/**
 * Generate a unique worker addressee
 */
function generateWorkerAddressee(taskType: TaskType): string {
  const uuid = crypto.randomUUID().slice(0, 8);
  return `worker-${taskType.toLowerCase()}-${uuid}`;
}

/**
 * Create a CODE task
 */
export async function createCodeTask(
  db: TaskDatabase,
  step: PlanStep,
  integrationBranch: string,
  projectContext: string,
  repoUrl: string
): Promise<string> {
  const prompt = buildCodeTaskPrompt(step, integrationBranch, projectContext);
  const addressee = generateWorkerAddressee("CODE");

  const task = await db.createTask({
    addressee,
    prompt,
    repo_url: repoUrl,
    branch: integrationBranch,
    created_by: `project-mgr-${config.projectId}`,
    project_id: config.projectId,
    task_type: "CODE",
  });

  log.info(`Created CODE task: ${task.id} for step ${step.id}`);
  return task.id;
}

/**
 * Create a MERGE task
 */
export async function createMergeTask(
  db: TaskDatabase,
  sourceBranch: string,
  targetBranch: string,
  repoUrl: string
): Promise<string> {
  const prompt = buildMergeTaskPrompt(sourceBranch, targetBranch);
  const addressee = generateWorkerAddressee("MERGE");

  const task = await db.createTask({
    addressee,
    prompt,
    repo_url: repoUrl,
    branch: targetBranch,
    created_by: `project-mgr-${config.projectId}`,
    project_id: config.projectId,
    task_type: "MERGE",
  });

  log.info(`Created MERGE task: ${task.id} (${sourceBranch} → ${targetBranch})`);
  return task.id;
}

/**
 * Create a REVIEW task
 */
export async function createReviewTask(
  db: TaskDatabase,
  branchToReview: string,
  stepDescription: string,
  repoUrl: string
): Promise<string> {
  const prompt = buildReviewTaskPrompt(branchToReview, stepDescription);
  const addressee = generateWorkerAddressee("REVIEW");

  const task = await db.createTask({
    addressee,
    prompt,
    repo_url: repoUrl,
    branch: branchToReview,
    created_by: `project-mgr-${config.projectId}`,
    project_id: config.projectId,
    task_type: "REVIEW",
  });

  log.info(`Created REVIEW task: ${task.id} for branch ${branchToReview}`);
  return task.id;
}

/**
 * Create a FIX task
 */
export async function createFixTask(
  db: TaskDatabase,
  branchToFix: string,
  issues: string[],
  integrationBranch: string,
  repoUrl: string
): Promise<string> {
  const prompt = buildFixTaskPrompt(branchToFix, issues, integrationBranch);
  const addressee = generateWorkerAddressee("FIX");

  const task = await db.createTask({
    addressee,
    prompt,
    repo_url: repoUrl,
    branch: branchToFix,
    created_by: `project-mgr-${config.projectId}`,
    project_id: config.projectId,
    task_type: "FIX",
  });

  log.info(`Created FIX task: ${task.id} for branch ${branchToFix}`);
  return task.id;
}

/**
 * Create a PR task
 */
export async function createPRTask(
  db: TaskDatabase,
  sourceBranch: string,
  targetBranch: string,
  title: string,
  epicDescription: string,
  repoUrl: string
): Promise<string> {
  const prompt = buildPRTaskPrompt(sourceBranch, targetBranch, title, epicDescription);
  const addressee = generateWorkerAddressee("PR");

  const task = await db.createTask({
    addressee,
    prompt,
    repo_url: repoUrl,
    branch: sourceBranch,
    created_by: `project-mgr-${config.projectId}`,
    project_id: config.projectId,
    task_type: "PR",
  });

  log.info(`Created PR task: ${task.id} (${sourceBranch} → ${targetBranch})`);
  return task.id;
}

/**
 * Create a VALIDATE task
 */
export async function createValidateTask(
  db: TaskDatabase,
  branch: string,
  repoUrl: string
): Promise<string> {
  const prompt = buildValidateTaskPrompt(branch);
  const addressee = generateWorkerAddressee("VALIDATE");

  const task = await db.createTask({
    addressee,
    prompt,
    repo_url: repoUrl,
    branch: branch,
    created_by: `project-mgr-${config.projectId}`,
    project_id: config.projectId,
    task_type: "VALIDATE",
  });

  log.info(`Created VALIDATE task: ${task.id} for branch ${branch}`);
  return task.id;
}
