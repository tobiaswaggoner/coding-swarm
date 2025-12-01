"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  parseJsonl,
  AssistantEvent,
  UserEvent,
  extractTextContent,
  extractToolUses,
  formatDuration,
  formatCost,
  getLogSummary,
  ToolUseContent,
} from "@/lib/jsonl-parser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Terminal,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Clock,
  Copy,
  Check,
  Cpu,
  Hash,
  Wrench,
} from "lucide-react";

// Reusable Markdown renderer with compact styling
export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-xs dark:prose-invert max-w-none prose-headings:text-sm prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1 prose-p:text-xs prose-p:my-1 prose-li:text-xs prose-li:my-0 prose-ul:my-1 prose-ol:my-1 prose-pre:bg-muted prose-pre:text-foreground prose-pre:text-xs prose-code:text-xs prose-code:text-foreground [&>*:first-child]:mt-0">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

interface LogViewerProps {
  jsonlContent: string;
}

export function LogViewer({ jsonlContent }: LogViewerProps) {
  const parsed = parseJsonl(jsonlContent);
  const summary = getLogSummary(parsed);

  if (parsed.events.length === 0 && parsed.shellOutput.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
        <Terminal className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">No log content available</p>
      </div>
    );
  }

  // Build conversation: interleave assistant events with their tool results
  const conversation: Array<{ assistant: AssistantEvent; toolResults: UserEvent[] }> = [];
  let currentAssistant: AssistantEvent | null = null;
  let currentToolResults: UserEvent[] = [];

  for (const event of parsed.events) {
    if (event.type === "assistant") {
      // Save previous assistant + results
      if (currentAssistant) {
        conversation.push({ assistant: currentAssistant, toolResults: currentToolResults });
      }
      currentAssistant = event as AssistantEvent;
      currentToolResults = [];
    } else if (event.type === "user" && currentAssistant) {
      currentToolResults.push(event as UserEvent);
    }
  }
  // Don't forget the last one
  if (currentAssistant) {
    conversation.push({ assistant: currentAssistant, toolResults: currentToolResults });
  }

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <LogSummary summary={summary} />

      {/* Shell Output (collapsible) */}
      {parsed.shellOutput.length > 0 && (
        <ShellOutputBlock lines={parsed.shellOutput} />
      )}

      {/* Conversation */}
      {conversation.length > 0 && (
        <div className="space-y-0">
          <h3 className="text-xs font-medium text-muted-foreground mb-2">
            Conversation ({conversation.length} turns)
          </h3>
          <div className="space-y-0.5">
            {conversation.map((turn, idx) => (
              <ConversationTurn
                key={idx}
                assistant={turn.assistant}
                toolResults={turn.toolResults}
                index={idx}
                total={conversation.length}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LogSummary({ summary }: { summary: ReturnType<typeof getLogSummary> }) {
  return (
    <div className="flex flex-wrap gap-3 rounded-lg bg-muted/50 p-4">
      {summary.model && (
        <StatBadge icon={Cpu} label="Model" value={summary.model.split("-").slice(0, 2).join(" ")} />
      )}
      <StatBadge icon={Hash} label="Turns" value={String(summary.totalTurns)} />
      <StatBadge icon={Wrench} label="Tool Calls" value={String(summary.toolCalls)} />
      {summary.durationMs !== null && (
        <StatBadge icon={Clock} label="Duration" value={formatDuration(summary.durationMs)} />
      )}
      {summary.costUsd !== null && (
        <StatBadge icon={DollarSign} label="Cost" value={formatCost(summary.costUsd)} />
      )}
    </div>
  );
}

function StatBadge({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-background px-3 py-1.5">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function ShellOutputBlock({ lines }: { lines: string[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="cursor-pointer border-l-2 border-l-muted-foreground/20 pl-3 py-1"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 text-xs">
        <Terminal className="h-3 w-3 text-muted-foreground/50" />
        <span className="text-muted-foreground/70">
          Agent Startup ({lines.length} lines)
        </span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
        )}
      </div>

      {expanded && (
        <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/50 p-2 text-[11px] font-mono text-muted-foreground/70">
          {lines.join("\n")}
        </pre>
      )}
    </div>
  );
}

function ConversationTurn({
  assistant,
  toolResults,
  index,
  total,
}: {
  assistant: AssistantEvent;
  toolResults: UserEvent[];
  index: number;
  total: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const textContent = extractTextContent(assistant);
  const toolUses = extractToolUses(assistant);

  // Get preview for first tool
  const getToolPreview = (tool: ToolUseContent) => {
    const input = tool.input;
    if (typeof input === "object" && input !== null) {
      if ("command" in input) return String(input.command).substring(0, 50);
      if ("file_path" in input) return String(input.file_path).split("/").pop();
      if ("pattern" in input) return String(input.pattern);
      if ("content" in input) return "(write)";
    }
    return "";
  };

  const firstTool = toolUses[0];
  const hasThinking = textContent.length > 0;

  return (
    <div
      className={`border-l-2 pl-3 py-1 cursor-pointer ${hasThinking ? "border-l-primary" : "border-l-muted-foreground/30"}`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Compact header */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground font-medium">{index + 1}</span>
        {hasThinking && (
          <span className="text-primary font-medium truncate max-w-xs">
            {textContent.substring(0, 60)}{textContent.length > 60 ? "..." : ""}
          </span>
        )}
        {toolUses.length > 0 && (
          <span className="text-muted-foreground/70 truncate">
            {firstTool.name}
            {getToolPreview(firstTool) && ` ${getToolPreview(firstTool)}`}
            {toolUses.length > 1 && ` +${toolUses.length - 1}`}
          </span>
        )}
        <span className="ml-auto">
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-2 space-y-2">
          {/* Text content - prominent */}
          {textContent && (
            <pre className="whitespace-pre-wrap break-words rounded-md bg-primary/5 border border-primary/20 p-2 text-xs font-mono">
              {textContent}
            </pre>
          )}

          {/* Tool uses - subdued */}
          {toolUses.map((tool, idx) => {
            const toolResult = toolResults.find((r) =>
              r.message.content.some((c) => c.tool_use_id === tool.id)
            );
            const resultContent = toolResult?.message.content.find(
              (c) => c.tool_use_id === tool.id
            );

            return (
              <ToolUseBlock
                key={idx}
                tool={tool}
                result={resultContent}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ToolUseBlock({
  tool,
  result,
}: {
  tool: ToolUseContent;
  result?: { content: string; is_error?: boolean };
}) {
  const [copied, setCopied] = useState(false);

  const inputJson = JSON.stringify(tool.input, null, 2);

  const copyToClipboard = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(inputJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isError = result?.is_error;

  return (
    <div
      className={`rounded border-l-2 pl-2 py-1 ${isError ? "border-l-destructive bg-destructive/5" : "border-l-muted-foreground/20"}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Tool header */}
      <div className="flex items-center gap-2 text-xs mb-2">
        <span className={`font-mono font-medium ${isError ? "text-destructive" : "text-muted-foreground"}`}>
          {tool.name}
        </span>
        {isError && <Badge variant="destructive" className="text-[10px] px-1 py-0">err</Badge>}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 ml-auto"
          onClick={copyToClipboard}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3 text-muted-foreground/50" />
          )}
        </Button>
      </div>

      {/* Input - always visible */}
      <div className="mb-2">
        <span className="text-[10px] text-muted-foreground/70 uppercase">Input</span>
        <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 text-[11px] font-mono max-h-32 text-muted-foreground">
          {inputJson}
        </pre>
      </div>

      {/* Result - always visible */}
      {result && (
        <div>
          <span className="text-[10px] text-muted-foreground/70 uppercase">Output</span>
          <pre className={`mt-1 overflow-x-auto rounded p-2 text-[11px] font-mono max-h-32 ${isError ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-muted-foreground"}`}>
            {result.content.substring(0, 1500)}
            {result.content.length > 1500 && "..."}
          </pre>
        </div>
      )}
    </div>
  );
}
