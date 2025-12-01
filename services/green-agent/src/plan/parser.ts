import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { Plan, PlanStep, StepStatus } from "./types.js";
import { log } from "../logger.js";

const PLAN_PATH = "/workspace/.ai/plan.md";

/**
 * Check if a plan file exists
 */
export function planExists(): boolean {
  return existsSync(PLAN_PATH);
}

/**
 * Read and parse the plan from .ai/plan.md
 */
export function loadPlan(): Plan | null {
  if (!planExists()) {
    log.info("No plan file found at .ai/plan.md");
    return null;
  }

  const content = readFileSync(PLAN_PATH, "utf8");
  return parsePlan(content);
}

/**
 * Parse a plan from markdown content
 */
export function parsePlan(content: string): Plan {
  const lines = content.split("\n");

  let epicName = "";
  let epicDescription = "";
  let integrationBranch = "";
  const steps: PlanStep[] = [];

  let currentStep: Partial<PlanStep> | null = null;
  let inEpicSection = false;
  let inStepsSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Parse epic name from H1
    if (trimmed.startsWith("# ") && !epicName) {
      epicName = trimmed.slice(2).split(" - ")[0].trim();
      continue;
    }

    // Check for section headers
    if (trimmed === "## Epic") {
      inEpicSection = true;
      inStepsSection = false;
      continue;
    }

    if (trimmed === "## Integration Branch") {
      inEpicSection = false;
      inStepsSection = false;
      continue;
    }

    if (trimmed === "## Schritte" || trimmed === "## Steps") {
      inEpicSection = false;
      inStepsSection = true;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      inEpicSection = false;
      inStepsSection = false;
      continue;
    }

    // Parse epic description
    if (inEpicSection && trimmed) {
      epicDescription += (epicDescription ? " " : "") + trimmed;
      continue;
    }

    // Parse integration branch
    if (trimmed && !inEpicSection && !inStepsSection && !integrationBranch) {
      const branchMatch = trimmed.match(/^(feature\/[\w-]+|[\w-]+\/[\w-]+)/);
      if (branchMatch) {
        integrationBranch = branchMatch[1];
      }
    }

    // Parse steps
    if (inStepsSection) {
      // Step header: ### Schritt N: Name or ### Step N: Name
      const stepMatch = trimmed.match(/^### (?:Schritt|Step)\s+(\d+):\s*(.+)$/i);
      if (stepMatch) {
        // Save previous step
        if (currentStep && currentStep.id !== undefined) {
          steps.push(currentStep as PlanStep);
        }
        currentStep = {
          id: parseInt(stepMatch[1], 10),
          name: stepMatch[2].trim(),
          status: "PENDING",
          description: "",
        };
        continue;
      }

      // Step properties
      if (currentStep) {
        const statusMatch = trimmed.match(/^-\s*Status:\s*(\w+)/i);
        if (statusMatch) {
          currentStep.status = statusMatch[1].toUpperCase() as StepStatus;
          continue;
        }

        const taskTypeMatch = trimmed.match(/^-\s*Task-Type:\s*(\w+)/i);
        if (taskTypeMatch) {
          currentStep.taskType = taskTypeMatch[1].toUpperCase() as PlanStep["taskType"];
          continue;
        }

        const branchMatch = trimmed.match(/^-\s*Branch:\s*(.+)$/i);
        if (branchMatch) {
          currentStep.branch = branchMatch[1].trim();
          continue;
        }

        const completedMatch = trimmed.match(/^-\s*Completed:\s*(.+)$/i);
        if (completedMatch) {
          currentStep.completedAt = completedMatch[1].trim();
          continue;
        }

        const descMatch = trimmed.match(/^-\s*(?:Beschreibung|Description):\s*(.+)$/i);
        if (descMatch) {
          currentStep.description = descMatch[1].trim();
          continue;
        }
      }
    }
  }

  // Save last step
  if (currentStep && currentStep.id !== undefined) {
    steps.push(currentStep as PlanStep);
  }

  return {
    epicName,
    epicDescription,
    integrationBranch,
    steps,
  };
}

/**
 * Serialize a plan to markdown
 */
export function serializePlan(plan: Plan): string {
  const lines: string[] = [];

  lines.push(`# ${plan.epicName} - Projektplan`);
  lines.push("");
  lines.push("## Epic");
  lines.push(plan.epicDescription);
  lines.push("");
  lines.push("## Integration Branch");
  lines.push(plan.integrationBranch);
  lines.push("");
  lines.push("## Schritte");
  lines.push("");

  for (const step of plan.steps) {
    lines.push(`### Schritt ${step.id}: ${step.name}`);
    lines.push(`- Status: ${step.status}`);
    if (step.taskType) {
      lines.push(`- Task-Type: ${step.taskType}`);
    }
    lines.push(`- Beschreibung: ${step.description}`);
    if (step.branch) {
      lines.push(`- Branch: ${step.branch}`);
    }
    if (step.completedAt) {
      lines.push(`- Completed: ${step.completedAt}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Save a plan to .ai/plan.md
 */
export function savePlan(plan: Plan): void {
  const content = serializePlan(plan);

  // Ensure directory exists
  const dir = dirname(PLAN_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(PLAN_PATH, content, "utf8");
  log.info("Plan saved to .ai/plan.md");
}

/**
 * Get the current step (first non-DONE step)
 */
export function getCurrentStep(plan: Plan): PlanStep | null {
  return plan.steps.find((s) => s.status !== "DONE") || null;
}

/**
 * Get the next pending step
 */
export function getNextPendingStep(plan: Plan): PlanStep | null {
  return plan.steps.find((s) => s.status === "PENDING") || null;
}

/**
 * Check if all steps are done
 */
export function allStepsDone(plan: Plan): boolean {
  return plan.steps.every((s) => s.status === "DONE");
}

/**
 * Update a step's status
 */
export function updateStepStatus(
  plan: Plan,
  stepId: number,
  status: StepStatus,
  branch?: string
): void {
  const step = plan.steps.find((s) => s.id === stepId);
  if (step) {
    step.status = status;
    if (branch) {
      step.branch = branch;
    }
    if (status === "DONE") {
      step.completedAt = new Date().toISOString();
    }
  }
}
