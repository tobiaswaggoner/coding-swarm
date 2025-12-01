import { config } from "./config.js";
import { log } from "./logger.js";
import { TaskDatabase } from "./db/supabase.js";
import { loadPlan, savePlan, planExists } from "./plan/parser.js";
import { TriggerContext } from "./plan/types.js";
import {
  parseTriggerContext,
  determineNextAction,
  executeDecision,
  generateInitialPlan,
} from "./decisions/engine.js";
import {
  commitAndPushFile,
  isGitRepo,
  ensureIntegrationBranch,
} from "./git/operations.js";

/**
 * Main entry point for Green Agent
 */
async function main(): Promise<void> {
  log.info("========================================");
  log.info("Green Agent (Project Manager) starting");
  log.info(`Project ID: ${config.projectId}`);
  log.info("========================================");

  const db = new TaskDatabase();

  // 1. Load or create project
  let project = await db.getProject(config.projectId);
  if (!project) {
    log.info(`Project ${config.projectId} not found, creating...`);
    project = await db.createProject({
      id: config.projectId,
      name: config.projectId,
      repo_url: config.repoUrl,
      default_branch: config.branch,
      integration_branch: config.integrationBranch || undefined,
      current_epic: config.taskPrompt || undefined,
      created_by: "green-agent",
    });
    log.info(`Created project: ${project.id}`);
  }

  // 2. Load trigger context if we were triggered by a completed task
  let triggerContext: TriggerContext | null = null;
  if (config.triggeredByTaskId) {
    log.info(`Loading trigger context from task: ${config.triggeredByTaskId}`);
    const completedTask = await db.getTask(config.triggeredByTaskId);
    if (completedTask) {
      triggerContext = parseTriggerContext(
        completedTask.id,
        completedTask.task_type,
        completedTask.result as Record<string, unknown> | null
      );
      log.info(`Trigger: ${triggerContext.taskType} task ${triggerContext.success ? "succeeded" : "failed"}`);
    }
  }

  // 3. Check if we're in a git repository
  if (!isGitRepo()) {
    log.error("Not in a git repository!");
    return;
  }

  // 4. Load or create plan
  let plan = loadPlan();
  let planCreated = false;

  if (!plan) {
    log.info("No plan found, generating initial plan...");

    // Get epic description from project or task prompt
    const epicPrompt = project.current_epic || config.taskPrompt;
    if (!epicPrompt) {
      log.error("No epic description found in project or task prompt");
      return;
    }

    plan = await generateInitialPlan(epicPrompt);

    // Update project with integration branch if not set
    if (!project.integration_branch && plan.integrationBranch) {
      await db.updateProject(config.projectId, {
        integration_branch: plan.integrationBranch,
      });
    }

    savePlan(plan);
    planCreated = true;
    log.info(`Created initial plan with ${plan.steps.length} steps`);

    // Ensure integration branch exists before creating any tasks
    if (plan.integrationBranch) {
      ensureIntegrationBranch(plan.integrationBranch, project.default_branch || "main");
    }
  }

  // 5. Determine next action
  log.info("Determining next action...");
  const decision = determineNextAction(plan, triggerContext);
  log.info(`Decision: ${decision.action} - ${decision.reason}`);

  // 6. Execute the decision
  await executeDecision(db, plan, decision, project.repo_url);

  // 7. Save and commit updated plan
  savePlan(plan);
  if (planCreated) {
    commitAndPushFile(".ai/plan.md", `Initial plan: ${plan.epicName}`);
  } else if (decision.action !== "NO_ACTION") {
    commitAndPushFile(".ai/plan.md", `Plan update: ${decision.action}`);
  }

  log.info("========================================");
  log.info(`Green Agent completed: ${decision.action}`);
  log.info("========================================");
}

// Run main and handle errors
main().catch((err) => {
  log.error(`Fatal error: ${err}`);
  console.error(err);
  process.exit(1);
});
