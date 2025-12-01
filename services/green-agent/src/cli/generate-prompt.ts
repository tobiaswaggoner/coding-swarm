#!/usr/bin/env node
/**
 * CLI: Generate the complete prompt for Green Agent Claude Code execution
 *
 * This script builds the full context prompt including:
 * - System prompt with available scripts
 * - Project information
 * - Current plan (if exists)
 * - Trigger context (what caused this run)
 * - Conversation history (for USER_MESSAGE triggers)
 *
 * Usage:
 *   node dist/cli/generate-prompt.js
 *
 * Environment:
 *   PROJECT_ID           - Project identifier (required)
 *   TRIGGERED_BY_TASK_ID - Task that triggered this run (optional)
 *   CONVERSATION_ID      - Conversation for USER_MESSAGE tasks (optional)
 *   SUPABASE_URL         - Database URL (required)
 *   SUPABASE_KEY         - Database key (required)
 *
 * Output:
 *   Prints the complete prompt to stdout (for use with claude -p)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Types
interface Project {
  id: string;
  name: string;
  repo_url: string;
  default_branch: string;
  integration_branch: string | null;
  status: string;
  current_epic: string | null;
}

interface Task {
  id: string;
  task_type: string | null;
  prompt: string;
  result: Record<string, unknown> | null;
  conversation_id: string | null;
}

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface TriggerContext {
  type: "TASK_COMPLETED" | "USER_MESSAGE" | "INITIAL";
  taskId?: string;
  taskType?: string;
  success?: boolean;
  summary?: string;
  branch?: string;
}

async function main() {
  const projectId = process.env.PROJECT_ID;
  const triggeredByTaskId = process.env.TRIGGERED_BY_TASK_ID;
  const conversationId = process.env.CONVERSATION_ID;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!projectId) {
    console.error("Error: PROJECT_ID is required");
    process.exit(1);
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error("Error: SUPABASE_URL and SUPABASE_KEY are required");
    process.exit(1);
  }

  const client = createClient(supabaseUrl, supabaseKey);

  // 1. Load project info
  const { data: project, error: projectError } = await client
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    console.error(`Error loading project: ${projectError?.message}`);
    process.exit(1);
  }

  // 2. Load trigger context
  let triggerContext: TriggerContext = { type: "INITIAL" };
  let effectiveConversationId = conversationId;

  if (triggeredByTaskId) {
    const { data: task } = await client
      .from("tasks")
      .select("*")
      .eq("id", triggeredByTaskId)
      .single();

    if (task) {
      const typedTask = task as Task;

      if (typedTask.task_type === "USER_MESSAGE") {
        triggerContext = {
          type: "USER_MESSAGE",
          taskId: typedTask.id,
        };
        // Get conversation_id from task if not provided
        if (!effectiveConversationId && typedTask.conversation_id) {
          effectiveConversationId = typedTask.conversation_id;
        }
      } else {
        const result = typedTask.result || {};
        triggerContext = {
          type: "TASK_COMPLETED",
          taskId: typedTask.id,
          taskType: typedTask.task_type || "UNKNOWN",
          success: Boolean(result.success),
          summary: result.summary as string | undefined,
          branch: result.branch as string | undefined,
        };
      }
    }
  }

  // 3. Load conversation history if applicable
  let conversationHistory = "";
  if (effectiveConversationId) {
    const { data: messages } = await client
      .from("messages")
      .select("*")
      .eq("conversation_id", effectiveConversationId)
      .order("created_at", { ascending: true });

    if (messages && messages.length > 0) {
      conversationHistory = (messages as Message[])
        .map((m) => `**${m.role.toUpperCase()}**: ${m.content}`)
        .join("\n\n");
    }
  }

  // 4. Load plan if exists
  let planContent = "";
  const planPath = "/workspace/.ai/plan.md";
  if (existsSync(planPath)) {
    planContent = readFileSync(planPath, "utf8");
  }

  // 5. Load system prompt template
  let systemPrompt = getDefaultSystemPrompt();
  const systemPromptPath = "/prompts/green/system.md";
  if (existsSync(systemPromptPath)) {
    systemPrompt = readFileSync(systemPromptPath, "utf8");
  }

  // 6. Build the complete prompt
  const prompt = buildPrompt(
    systemPrompt,
    project as Project,
    planContent,
    triggerContext,
    conversationHistory
  );

  // Output the prompt (will be captured by entrypoint.sh)
  console.log(prompt);
}

function getDefaultSystemPrompt(): string {
  return `Du bist der Project Manager (Green Agent) im Coding Swarm System.

## KRITISCH: Was du NIEMALS tun darfst

**DU BIST NUR FUER PLANUNG UND DELEGATION ZUSTAENDIG. DU IMPLEMENTIERST NIEMALS SELBST.**

VERBOTEN:
- KEIN Code schreiben oder aendern (ausser .ai/plan.md)
- KEINE Git-Befehle (kein git checkout, merge, commit etc.)
- KEIN Task-Tool verwenden (keine Sub-Agents spawnen)
- KEINE Bash-Befehle ausser die 4 erlaubten Scripts

## Die 4 erlaubten Scripts

### 1. Arbeit delegieren
\`\`\`bash
/app/scripts/delegate-to-red.sh "<aufgabe>" "[branch]"
\`\`\`

### 2. User antworten
\`\`\`bash
/app/scripts/send-message.sh "<nachricht>"
\`\`\`

### 3. Plan committen (nach Edit von .ai/plan.md)
\`\`\`bash
/app/scripts/update-plan.sh "<commit-message>"
\`\`\`

### 4. Rueckfrage stellen
\`\`\`bash
/app/scripts/request-clarification.sh "<frage>"
\`\`\`

## Workflow

Bei USER_MESSAGE: Antworte, dann delegiere falls noetig.
Bei TASK_COMPLETED: Update Plan, delegiere naechsten Step.
Bei neuem Projekt: Erstelle Plan, informiere User, delegiere Step 1.`;
}

function buildPrompt(
  systemPrompt: string,
  project: Project,
  planContent: string,
  trigger: TriggerContext,
  conversationHistory: string
): string {
  const sections: string[] = [systemPrompt];

  // Project context
  sections.push(`
## Aktueller Kontext

### Projekt
- **ID**: ${project.id}
- **Name**: ${project.name}
- **Repository**: ${project.repo_url}
- **Default Branch**: ${project.default_branch}
- **Integration Branch**: ${project.integration_branch || "nicht gesetzt"}
- **Status**: ${project.status}
- **Epic**: ${project.current_epic || "nicht definiert"}`);

  // Plan
  if (planContent) {
    sections.push(`
### Aktueller Plan
\`\`\`markdown
${planContent}
\`\`\``);
  } else {
    sections.push(`
### Plan
Es existiert noch kein Plan (.ai/plan.md). Falls dies ein neues Projekt ist, erstelle einen Plan basierend auf dem Epic.`);
  }

  // Trigger context
  sections.push(`
### Ausloeser dieses Runs
${formatTriggerContext(trigger)}`);

  // Conversation history
  if (conversationHistory) {
    sections.push(`
### Conversation
${conversationHistory}`);
  }

  // Final instruction based on trigger type
  sections.push(`
## Deine Aufgabe
${getTaskInstruction(trigger, conversationHistory.length > 0)}`);

  return sections.join("\n");
}

function formatTriggerContext(trigger: TriggerContext): string {
  switch (trigger.type) {
    case "USER_MESSAGE":
      return `**User-Nachricht**: Der User hat eine neue Nachricht geschickt. Lies die Conversation und antworte angemessen.`;

    case "TASK_COMPLETED":
      return `**Task abgeschlossen**: ${trigger.taskType} Task (${trigger.taskId})
- Erfolg: ${trigger.success ? "Ja" : "Nein"}
- Zusammenfassung: ${trigger.summary || "keine"}
- Branch: ${trigger.branch || "keiner"}`;

    case "INITIAL":
    default:
      return `**Initialer Run**: Dies ist der erste Run fuer dieses Projekt oder ein manueller Trigger.`;
  }
}

function getTaskInstruction(
  trigger: TriggerContext,
  hasConversation: boolean
): string {
  if (trigger.type === "USER_MESSAGE") {
    return `Lies die Conversation oben und antworte auf die letzte User-Nachricht.

1. Verstehe was der User moechte
2. Sende eine Antwort mit ./scripts/send-message.sh
3. Falls Code-Arbeit noetig ist, erstelle Tasks mit ./scripts/delegate-to-red.sh
4. Falls der Plan angepasst werden muss, aktualisiere .ai/plan.md`;
  }

  if (trigger.type === "TASK_COMPLETED") {
    if (trigger.success) {
      return `Der ${trigger.taskType} Task war erfolgreich. Entscheide:

1. Ist ein Folge-Task noetig? (z.B. nach CODE kommt oft MERGE)
2. Muss der Plan aktualisiert werden?
3. Soll der User informiert werden?

Fuehre die passenden Aktionen aus.`;
    } else {
      return `Der ${trigger.taskType} Task ist fehlgeschlagen. Entscheide:

1. Kann der Fehler automatisch behoben werden? (neuer Task)
2. Braucht es User-Input? (Rueckfrage stellen)
3. Muss das Projekt pausiert werden?

Informiere den User ueber den Status.`;
    }
  }

  // Initial run
  if (hasConversation) {
    return `Dies ist ein initialer Run mit bestehender Conversation. Lies die Nachrichten und entscheide, was zu tun ist.`;
  }

  return `Dies ist ein neues Projekt. Falls ein Epic definiert ist:

1. Erstelle einen Plan in .ai/plan.md
2. Informiere den User ueber den Plan
3. Starte mit dem ersten Schritt (delegate-to-red)

Falls kein Epic definiert ist, warte auf User-Input.`;
}

main().catch((err) => {
  console.error(`Fatal error: ${err}`);
  process.exit(1);
});
