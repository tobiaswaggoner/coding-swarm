import { PlanStep } from "../plan/types.js";
import { renderPrompt } from "../prompts/loader.js";

/**
 * Build a CODE task prompt
 */
export function buildCodeTaskPrompt(
  step: PlanStep,
  integrationBranch: string,
  projectContext: string
): string {
  const branchName = `feature/step-${step.id}-${step.name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 20)}-${Date.now()}`;

  return renderPrompt("code", {
    STEP_NAME: step.name,
    INTEGRATION_BRANCH: integrationBranch,
    BRANCH_NAME: branchName,
    PROJECT_CONTEXT: projectContext,
    STEP_DESCRIPTION: step.description,
  });
}

/**
 * Build a MERGE task prompt
 */
export function buildMergeTaskPrompt(
  sourceBranch: string,
  targetBranch: string
): string {
  return renderPrompt("merge", {
    SOURCE_BRANCH: sourceBranch,
    TARGET_BRANCH: targetBranch,
  });
}

/**
 * Build a REVIEW task prompt
 */
export function buildReviewTaskPrompt(
  branchToReview: string,
  stepDescription: string
): string {
  return renderPrompt("review", {
    BRANCH_TO_REVIEW: branchToReview,
    STEP_DESCRIPTION: stepDescription,
  });
}

/**
 * Build a FIX task prompt
 */
export function buildFixTaskPrompt(
  branchToFix: string,
  issues: string[],
  integrationBranch: string
): string {
  const issuesList = issues.map((i) => `- ${i}`).join("\n");

  return renderPrompt("fix", {
    BRANCH_TO_FIX: branchToFix,
    ISSUES_LIST: issuesList,
    INTEGRATION_BRANCH: integrationBranch,
  });
}

/**
 * Build a PR task prompt
 */
export function buildPRTaskPrompt(
  sourceBranch: string,
  targetBranch: string,
  title: string,
  epicDescription: string
): string {
  return renderPrompt("pr", {
    SOURCE_BRANCH: sourceBranch,
    TARGET_BRANCH: targetBranch,
    PR_TITLE: title,
    EPIC_DESCRIPTION: epicDescription,
  });
}

/**
 * Build a VALIDATE task prompt
 */
export function buildValidateTaskPrompt(branch: string): string {
  return renderPrompt("validate", {
    BRANCH: branch,
  });
}
