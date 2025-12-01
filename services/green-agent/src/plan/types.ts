/**
 * Step status in the plan
 */
export type StepStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "MERGING"
  | "DONE"
  | "FAILED";

/**
 * A single step in the plan
 */
export interface PlanStep {
  id: number;
  name: string;
  status: StepStatus;
  description: string;
  taskType?: "CODE" | "MERGE" | "REVIEW" | "FIX" | "PR" | "VALIDATE";
  branch?: string;
  completedAt?: string;
}

/**
 * The full project plan
 */
export interface Plan {
  epicName: string;
  epicDescription: string;
  integrationBranch: string;
  steps: PlanStep[];
}

/**
 * Result of parsing the trigger context
 */
export interface TriggerContext {
  taskId: string;
  taskType: string;
  success: boolean;
  branch?: string;
  summary?: string;
  prUrl?: string;
  prNumber?: number;
  conflicts?: boolean;
  decision?: "APPROVE" | "REQUEST_CHANGES" | "REJECT";
  issues?: string[];
}
