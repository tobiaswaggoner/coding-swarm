/**
 * JSONL Parser for Claude CLI stream-json output
 *
 * The log contains:
 * 1. Shell output from entrypoint.sh (plain text lines before/after JSONL)
 * 2. JSONL output from Claude CLI with these event types:
 *    - system: Init event with tools, model info
 *    - assistant: Claude's responses (text + tool_use)
 *    - user: Tool results
 *    - result: Final summary with cost, duration, etc.
 */

// ============================================================================
// Types for Claude CLI JSONL format
// ============================================================================

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock = TextContent | ToolUseContent | ToolResultContent;

export interface ClaudeMessage {
  model?: string;
  id?: string;
  type: "message";
  role: "assistant" | "user";
  content: ContentBlock[];
  stop_reason?: string | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

/** System init event */
export interface SystemEvent {
  type: "system";
  subtype: string;
  cwd?: string;
  session_id?: string;
  tools?: string[];
  model?: string;
  claude_code_version?: string;
}

/** Assistant turn event */
export interface AssistantEvent {
  type: "assistant";
  message: ClaudeMessage;
  session_id?: string;
  uuid?: string;
}

/** User turn event (tool results) */
export interface UserEvent {
  type: "user";
  message: {
    role: "user";
    content: Array<{
      tool_use_id: string;
      type: "tool_result";
      content: string;
      is_error?: boolean;
    }>;
  };
  session_id?: string;
  uuid?: string;
  tool_use_result?: unknown;
}

/** Final result event */
export interface ResultEvent {
  type: "result";
  subtype: string;
  is_error?: boolean;
  duration_ms?: number;
  duration_api_ms?: number;
  num_turns?: number;
  result?: string;
  session_id?: string;
  total_cost_usd?: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export type JsonlEvent = SystemEvent | AssistantEvent | UserEvent | ResultEvent | { type: string; [key: string]: unknown };

export interface ParsedLog {
  /** All parsed JSONL events */
  events: JsonlEvent[];
  /** System init event */
  systemInit: SystemEvent | null;
  /** Assistant events (Claude's responses) */
  assistantEvents: AssistantEvent[];
  /** User events (tool results) */
  userEvents: UserEvent[];
  /** Final result event */
  result: ResultEvent | null;
  /** Shell output lines from entrypoint.sh */
  shellOutput: string[];
}

// ============================================================================
// Parser
// ============================================================================

/**
 * Parse mixed log content (shell output + JSONL)
 */
export function parseJsonl(content: string): ParsedLog {
  const result: ParsedLog = {
    events: [],
    systemInit: null,
    assistantEvents: [],
    userEvents: [],
    result: null,
    shellOutput: [],
  };

  if (!content || content.trim() === "") {
    return result;
  }

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === "") continue;

    // Try to parse as JSON if it looks like JSON
    if (trimmed.startsWith("{")) {
      try {
        const event = JSON.parse(trimmed) as JsonlEvent;
        result.events.push(event);

        switch (event.type) {
          case "system":
            if ((event as SystemEvent).subtype === "init") {
              result.systemInit = event as SystemEvent;
            }
            break;
          case "assistant":
            result.assistantEvents.push(event as AssistantEvent);
            break;
          case "user":
            result.userEvents.push(event as UserEvent);
            break;
          case "result":
            result.result = event as ResultEvent;
            break;
        }
        continue;
      } catch {
        // Failed to parse as JSON - treat as shell output
        result.shellOutput.push(line);
        continue;
      }
    }

    // Everything else is shell output
    result.shellOutput.push(line);
  }

  return result;
}

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Extract text content from an assistant event
 */
export function extractTextContent(event: AssistantEvent): string {
  return event.message.content
    .filter((block): block is TextContent => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

/**
 * Extract tool uses from an assistant event
 */
export function extractToolUses(event: AssistantEvent): ToolUseContent[] {
  return event.message.content.filter(
    (block): block is ToolUseContent => block.type === "tool_use"
  );
}

/**
 * Get a summary of the log for display
 */
export function getLogSummary(parsed: ParsedLog): {
  totalTurns: number;
  toolCalls: number;
  costUsd: number | null;
  durationMs: number | null;
  hasError: boolean;
  hasResult: boolean;
  model: string | null;
} {
  const toolCalls = parsed.assistantEvents.reduce(
    (count, event) => count + extractToolUses(event).length,
    0
  );

  return {
    totalTurns: parsed.result?.num_turns ?? parsed.assistantEvents.length,
    toolCalls,
    costUsd: parsed.result?.total_cost_usd ?? null,
    durationMs: parsed.result?.duration_ms ?? null,
    hasError: parsed.result?.is_error ?? false,
    hasResult: parsed.result !== null,
    model: parsed.systemInit?.model ?? null,
  };
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format cost in human-readable format
 */
export function formatCost(usd: number): string {
  if (usd < 0.01) return `<$0.01`;
  return `$${usd.toFixed(2)}`;
}
