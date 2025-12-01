import { K8sClients } from "./client.js";
import { config } from "../config.js";

/**
 * Get logs from all pods of a job
 */
export async function getJobLogs(
  clients: K8sClients,
  jobName: string
): Promise<string> {
  // Find pods belonging to this job
  const podsResponse = await clients.coreApi.listNamespacedPod(
    config.jobNamespace,
    undefined,
    undefined,
    undefined,
    undefined,
    `job-name=${jobName}`
  );

  const pods = podsResponse.body.items;
  if (pods.length === 0) {
    return "";
  }

  // Get logs from the first (and usually only) pod
  const podName = pods[0].metadata?.name;
  if (!podName) {
    return "";
  }

  try {
    const logResponse = await clients.coreApi.readNamespacedPodLog(
      podName,
      config.jobNamespace,
      "agent" // container name
    );
    return logResponse.body || "";
  } catch (err: unknown) {
    const error = err as { response?: { statusCode?: number } };
    // Pod might be gone already
    if (error.response?.statusCode === 404) {
      return "";
    }
    throw err;
  }
}

/**
 * Extract branch name from summary text
 * Looks for patterns like:
 * - `feature/step-1-xxx`
 * - Branch-Name: feature/xxx
 * - Branch: feature/xxx
 */
function extractBranchFromSummary(summary: string): string | undefined {
  // Pattern 1: Markdown code block with branch name (most common)
  // Matches: `feature/step-1-xxx` or `feature/xxx-123`
  const codeBlockMatch = summary.match(/`(feature\/[a-zA-Z0-9_-]+)`/);
  if (codeBlockMatch) {
    return codeBlockMatch[1];
  }

  // Pattern 2: "Branch-Name:" or "Branch:" followed by branch name
  const branchLabelMatch = summary.match(
    /Branch(?:-Name)?:\s*`?([a-zA-Z0-9_/-]+)`?/i
  );
  if (branchLabelMatch) {
    return branchLabelMatch[1];
  }

  // Pattern 3: Any feature branch pattern in the text
  const featureBranchMatch = summary.match(
    /\b(feature\/[a-zA-Z0-9_-]+(?:-[a-zA-Z0-9_-]+)*)\b/
  );
  if (featureBranchMatch) {
    return featureBranchMatch[1];
  }

  return undefined;
}

/**
 * Parse JSONL logs to extract final result
 * Claude CLI outputs JSON lines; we look for the final result message.
 */
export function parseJsonlResult(logs: string): {
  success: boolean;
  summary: string;
  branch?: string;
  cost_usd?: number;
  duration_ms?: number;
} {
  const lines = logs.trim().split("\n").filter(Boolean);

  let lastAssistantMessage = "";
  let totalCost = 0;
  let totalDuration = 0;

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);

      // Track assistant messages
      if (parsed.type === "assistant" && parsed.message?.content) {
        const textContent = parsed.message.content.find(
          (c: { type: string }) => c.type === "text"
        );
        if (textContent?.text) {
          lastAssistantMessage = textContent.text;
        }
      }

      // Track result/usage info
      if (parsed.type === "result") {
        if (parsed.cost_usd) totalCost = parsed.cost_usd;
        if (parsed.duration_ms) totalDuration = parsed.duration_ms;
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  // Determine success based on whether we got a meaningful response
  const success = lastAssistantMessage.length > 0;

  // Try to extract branch name from the summary
  const branch = extractBranchFromSummary(lastAssistantMessage);

  return {
    success,
    summary: lastAssistantMessage.slice(0, 1000) || "No output captured",
    ...(branch && { branch }),
    ...(totalCost > 0 && { cost_usd: totalCost }),
    ...(totalDuration > 0 && { duration_ms: totalDuration }),
  };
}
