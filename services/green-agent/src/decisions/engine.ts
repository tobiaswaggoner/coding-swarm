import { execSync } from "child_process";
import { Plan, PlanStep, TriggerContext } from "../plan/types.js";
import {
  getCurrentStep,
  getNextPendingStep,
  allStepsDone,
  updateStepStatus,
} from "../plan/parser.js";
import { TaskDatabase } from "../db/supabase.js";
import { config } from "../config.js";
import { log } from "../logger.js";
import {
  createCodeTask,
  createMergeTask,
  createReviewTask,
  createFixTask,
  createPRTask,
} from "../tasks/creator.js";
import { renderPrompt } from "../prompts/loader.js";

/**
 * Decision action types
 */
export type DecisionAction =
  | "CREATE_CODE_TASK"
  | "CREATE_MERGE_TASK"
  | "CREATE_REVIEW_TASK"
  | "CREATE_FIX_TASK"
  | "CREATE_PR_TASK"
  | "MARK_AWAITING_REVIEW"
  | "PAUSE_FOR_REVIEW"
  | "DISCARD_AND_RETRY"
  | "COMPLETE_PROJECT"
  | "NO_ACTION";

/**
 * Decision result
 */
export interface Decision {
  action: DecisionAction;
  reason: string;
  stepId?: number;
  branch?: string;
  issues?: string[];
}

/**
 * Parse the trigger context from a completed task's result
 */
export function parseTriggerContext(
  taskId: string,
  taskType: string | null,
  result: Record<string, unknown> | null
): TriggerContext {
  return {
    taskId,
    taskType: taskType || "UNKNOWN",
    success: Boolean(result?.success),
    branch: result?.branch as string | undefined,
    summary: result?.summary as string | undefined,
    prUrl: result?.pr_url as string | undefined,
    prNumber: result?.pr_number as number | undefined,
    conflicts: result?.conflicts as boolean | undefined,
    decision: result?.decision as TriggerContext["decision"],
    issues: result?.issues as string[] | undefined,
  };
}

/**
 * Determine the next action based on plan state and trigger context
 */
export function determineNextAction(
  plan: Plan,
  trigger: TriggerContext | null
): Decision {
  // If no trigger (initial run), start with first step
  if (!trigger) {
    const firstPending = getNextPendingStep(plan);
    if (!firstPending) {
      if (allStepsDone(plan)) {
        return { action: "CREATE_PR_TASK", reason: "All steps done, creating PR" };
      }
      return { action: "NO_ACTION", reason: "No pending steps found" };
    }
    return {
      action: "CREATE_CODE_TASK",
      reason: `Starting first step: ${firstPending.name}`,
      stepId: firstPending.id,
    };
  }

  // Handle based on completed task type
  switch (trigger.taskType) {
    case "CODE":
      return handleCodeTaskCompletion(plan, trigger);

    case "MERGE":
      return handleMergeTaskCompletion(plan, trigger);

    case "REVIEW":
      return handleReviewTaskCompletion(plan, trigger);

    case "FIX":
      return handleFixTaskCompletion(plan, trigger);

    case "PR":
      return handlePRTaskCompletion(plan, trigger);

    case "VALIDATE":
      return handleValidateTaskCompletion(plan, trigger);

    default:
      log.warn(`Unknown task type: ${trigger.taskType}`);
      return { action: "NO_ACTION", reason: `Unknown task type: ${trigger.taskType}` };
  }
}

/**
 * Handle CODE task completion
 */
function handleCodeTaskCompletion(
  plan: Plan,
  trigger: TriggerContext
): Decision {
  const currentStep = getCurrentStep(plan);

  if (!trigger.success) {
    // Task failed - pause for review
    return {
      action: "PAUSE_FOR_REVIEW",
      reason: `CODE task failed: ${trigger.summary}`,
      stepId: currentStep?.id,
    };
  }

  // Success - create merge task
  if (!trigger.branch) {
    return {
      action: "PAUSE_FOR_REVIEW",
      reason: "CODE task succeeded but no branch reported",
    };
  }

  return {
    action: "CREATE_MERGE_TASK",
    reason: `CODE task succeeded, merging ${trigger.branch}`,
    stepId: currentStep?.id,
    branch: trigger.branch,
  };
}

/**
 * Handle MERGE task completion
 */
function handleMergeTaskCompletion(
  plan: Plan,
  trigger: TriggerContext
): Decision {
  const currentStep = getCurrentStep(plan);

  if (!trigger.success) {
    // Merge failed - pause for review
    return {
      action: "PAUSE_FOR_REVIEW",
      reason: `MERGE task failed: ${trigger.summary}`,
      stepId: currentStep?.id,
    };
  }

  // Merge succeeded - mark step as done and check for next step
  if (currentStep) {
    updateStepStatus(plan, currentStep.id, "DONE");
  }

  // Check if all steps are done
  if (allStepsDone(plan)) {
    return {
      action: "CREATE_PR_TASK",
      reason: "All steps completed, creating PR",
    };
  }

  // Get next pending step
  const nextStep = getNextPendingStep(plan);
  if (nextStep) {
    return {
      action: "CREATE_CODE_TASK",
      reason: `Merge complete, starting next step: ${nextStep.name}`,
      stepId: nextStep.id,
    };
  }

  return { action: "NO_ACTION", reason: "No more steps to process" };
}

/**
 * Handle REVIEW task completion
 */
function handleReviewTaskCompletion(
  plan: Plan,
  trigger: TriggerContext
): Decision {
  const currentStep = getCurrentStep(plan);

  if (!trigger.success) {
    return {
      action: "PAUSE_FOR_REVIEW",
      reason: `REVIEW task failed: ${trigger.summary}`,
    };
  }

  switch (trigger.decision) {
    case "APPROVE":
      return {
        action: "CREATE_MERGE_TASK",
        reason: "Review approved, proceeding with merge",
        stepId: currentStep?.id,
        branch: trigger.branch,
      };

    case "REQUEST_CHANGES":
      return {
        action: "CREATE_FIX_TASK",
        reason: "Review requested changes",
        stepId: currentStep?.id,
        branch: trigger.branch,
        issues: trigger.issues,
      };

    case "REJECT":
      return {
        action: "DISCARD_AND_RETRY",
        reason: "Review rejected, will retry with new approach",
        stepId: currentStep?.id,
      };

    default:
      return {
        action: "PAUSE_FOR_REVIEW",
        reason: `Unknown review decision: ${trigger.decision}`,
      };
  }
}

/**
 * Handle FIX task completion
 */
function handleFixTaskCompletion(
  plan: Plan,
  trigger: TriggerContext
): Decision {
  const currentStep = getCurrentStep(plan);

  if (!trigger.success) {
    return {
      action: "PAUSE_FOR_REVIEW",
      reason: `FIX task failed: ${trigger.summary}`,
    };
  }

  // Fix succeeded - merge the fixed branch
  return {
    action: "CREATE_MERGE_TASK",
    reason: "Fix complete, merging",
    stepId: currentStep?.id,
    branch: trigger.branch,
  };
}

/**
 * Handle PR task completion
 */
function handlePRTaskCompletion(
  plan: Plan,
  trigger: TriggerContext
): Decision {
  if (!trigger.success) {
    return {
      action: "PAUSE_FOR_REVIEW",
      reason: `PR task failed: ${trigger.summary}`,
    };
  }

  // PR created successfully
  return {
    action: "MARK_AWAITING_REVIEW",
    reason: `PR created: ${trigger.prUrl}`,
  };
}

/**
 * Handle VALIDATE task completion
 */
function handleValidateTaskCompletion(
  plan: Plan,
  trigger: TriggerContext
): Decision {
  const currentStep = getCurrentStep(plan);

  if (!trigger.success) {
    return {
      action: "CREATE_FIX_TASK",
      reason: `Validation failed: ${trigger.summary}`,
      stepId: currentStep?.id,
      issues: [trigger.summary || "Validation failed"],
    };
  }

  // Validation passed - continue with merge
  return {
    action: "CREATE_MERGE_TASK",
    reason: "Validation passed, merging",
    stepId: currentStep?.id,
    branch: trigger.branch,
  };
}

/**
 * Execute the decision
 */
export async function executeDecision(
  db: TaskDatabase,
  plan: Plan,
  decision: Decision,
  repoUrl: string
): Promise<void> {
  const integrationBranch = plan.integrationBranch || config.integrationBranch || "main";

  switch (decision.action) {
    case "CREATE_CODE_TASK": {
      const step = plan.steps.find((s) => s.id === decision.stepId);
      if (!step) {
        throw new Error(`Step ${decision.stepId} not found`);
      }
      updateStepStatus(plan, step.id, "IN_PROGRESS");
      await createCodeTask(db, step, integrationBranch, plan.epicDescription, repoUrl);
      break;
    }

    case "CREATE_MERGE_TASK": {
      const step = plan.steps.find((s) => s.id === decision.stepId);
      if (step) {
        updateStepStatus(plan, step.id, "MERGING");
      }
      if (!decision.branch) {
        throw new Error("No branch specified for merge");
      }
      await createMergeTask(db, decision.branch, integrationBranch, repoUrl);
      break;
    }

    case "CREATE_REVIEW_TASK": {
      const step = plan.steps.find((s) => s.id === decision.stepId);
      if (!decision.branch) {
        throw new Error("No branch specified for review");
      }
      await createReviewTask(
        db,
        decision.branch,
        step?.description || "",
        repoUrl
      );
      break;
    }

    case "CREATE_FIX_TASK": {
      if (!decision.branch) {
        throw new Error("No branch specified for fix");
      }
      await createFixTask(
        db,
        decision.branch,
        decision.issues || ["Fix required"],
        integrationBranch,
        repoUrl
      );
      break;
    }

    case "CREATE_PR_TASK": {
      await createPRTask(
        db,
        integrationBranch,
        "main",
        plan.epicName,
        plan.epicDescription,
        repoUrl
      );
      break;
    }

    case "MARK_AWAITING_REVIEW": {
      await db.updateProject(config.projectId, {
        status: "awaiting_review",
      });
      log.info("Project marked as awaiting_review");
      break;
    }

    case "PAUSE_FOR_REVIEW": {
      await db.updateProject(config.projectId, {
        status: "paused",
      });
      log.warn(`Project paused: ${decision.reason}`);
      break;
    }

    case "COMPLETE_PROJECT": {
      await db.updateProject(config.projectId, {
        status: "completed",
      });
      log.info("Project completed!");
      break;
    }

    case "DISCARD_AND_RETRY": {
      // For now, just pause - in the future we could auto-retry
      await db.updateProject(config.projectId, {
        status: "paused",
      });
      log.warn(`Discarding branch, project paused for manual intervention`);
      break;
    }

    case "NO_ACTION":
      log.info(`No action needed: ${decision.reason}`);
      break;
  }
}

/**
 * Use Claude to generate an initial plan for a new epic
 */
export async function generateInitialPlan(epicPrompt: string): Promise<Plan> {
  log.info("Generating initial plan with Claude...");

  // Load prompt template and render with epic description
  const planPrompt = renderPrompt("plan-generation", {
    EPIC_PROMPT: epicPrompt,
  });

  try {
    // Call Claude CLI to generate the plan
    const result = execSync(
      `claude -p "${planPrompt.replace(/"/g, '\\"')}" --output-format text`,
      {
        encoding: "utf8",
        cwd: "/workspace",
        timeout: 120000, // 2 minute timeout
      }
    );

    // Parse the generated plan
    const { parsePlan } = await import("../plan/parser.js");
    const plan = parsePlan(result);

    log.info(`Generated plan with ${plan.steps.length} steps`);
    return plan;
  } catch (err) {
    log.error(`Failed to generate plan: ${err}`);
    // Return a minimal plan as fallback
    return {
      epicName: "Project",
      epicDescription: epicPrompt.slice(0, 200),
      integrationBranch: `feature/${config.projectId}`,
      steps: [
        {
          id: 1,
          name: "Initial Implementation",
          status: "PENDING",
          description: epicPrompt,
          taskType: "CODE",
        },
      ],
    };
  }
}
