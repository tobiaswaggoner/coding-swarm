#!/usr/bin/env node
/**
 * Unified Prompt Generator for all Agent Roles
 *
 * This script builds the complete context prompt based on:
 * - Agent role (developer, project-manager, reviewer)
 * - Runtime configuration (from coding-swarm-runtime repo)
 * - Project context (from .ai/ directory)
 * - GitHub context (branches, commits, PRs)
 * - Database context (for project-manager: tasks, conversations)
 *
 * Usage:
 *   node dist/generate-prompt.js
 *
 * Environment:
 *   AGENT_ROLE          - Role: developer, project-manager, reviewer
 *   RUNTIME_DIR         - Path to cloned runtime repo (optional)
 *   TASK_PROMPT         - Direct task description
 *   GITHUB_CONTEXT      - Pre-collected GitHub info
 *   PROJECT_ID          - Project ID (for project-manager)
 *   TRIGGERED_BY_TASK_ID - Triggering task (for project-manager)
 *   CONVERSATION_ID     - Active conversation (for project-manager)
 *
 * Output:
 *   Prints the complete prompt to stdout
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { loadBaseConfig, loadProjectManagerConfig, hasSupabase } from "./config.js";
import { createDatabase } from "./db/supabase.js";
// =============================================================================
// Main
// =============================================================================
async function main() {
    const config = loadBaseConfig();
    const sections = [];
    // Build context based on role
    const context = {
        role: config.role,
        runtimeDir: config.runtimeDir,
        taskPrompt: config.taskPrompt,
        githubContext: config.githubContext,
    };
    // Load role-specific context
    if (config.role === "project-manager" && hasSupabase()) {
        await loadProjectManagerContext(context);
    }
    else {
        loadDeveloperContext(context);
    }
    // 1. System Prompt (role-specific)
    const systemPrompt = loadSystemPrompt(context.role, context.runtimeDir);
    sections.push(systemPrompt);
    // 2. Project Context (from .ai/ or database)
    const projectContext = buildProjectContext(context);
    if (projectContext) {
        sections.push(projectContext);
    }
    // 3. Active Story (for developers)
    if (config.role === "developer" && context.activeStory) {
        sections.push(`## Aktive Story\n\n${context.activeStory}`);
    }
    // 4. GitHub Context
    if (context.githubContext) {
        sections.push(context.githubContext);
    }
    // 5. Trigger Context (for project-manager)
    if (context.trigger) {
        sections.push(buildTriggerSection(context.trigger));
    }
    // 6. Conversation History (for project-manager with USER_MESSAGE)
    if (context.conversationHistory) {
        sections.push(`## Conversation\n\n${context.conversationHistory}`);
    }
    // 7. Task Prompt / Instructions
    const taskSection = buildTaskSection(context);
    sections.push(taskSection);
    // Output the complete prompt
    console.log(sections.join("\n\n---\n\n"));
}
// =============================================================================
// Context Loaders
// =============================================================================
async function loadProjectManagerContext(context) {
    const pmConfig = loadProjectManagerConfig();
    const db = createDatabase();
    if (!db) {
        console.error("Warning: Database not available for project-manager");
        return;
    }
    // Load project
    if (pmConfig.projectId) {
        const project = await db.getProject(pmConfig.projectId);
        if (project) {
            context.project = project;
        }
    }
    // Load trigger context
    context.trigger = { type: "INITIAL" };
    let effectiveConversationId = pmConfig.conversationId;
    if (pmConfig.triggeredByTaskId) {
        const task = await db.getTask(pmConfig.triggeredByTaskId);
        if (task) {
            if (task.task_type === "USER_MESSAGE") {
                context.trigger = {
                    type: "USER_MESSAGE",
                    taskId: task.id,
                };
                if (!effectiveConversationId && task.conversation_id) {
                    effectiveConversationId = task.conversation_id;
                }
            }
            else {
                const result = (task.result || {});
                context.trigger = {
                    type: "TASK_COMPLETED",
                    taskId: task.id,
                    taskType: task.task_type || "UNKNOWN",
                    success: Boolean(result.success),
                    summary: result.summary,
                    branch: result.branch,
                };
            }
        }
    }
    // Load conversation history
    if (effectiveConversationId) {
        const messages = await db.getMessages(effectiveConversationId);
        if (messages.length > 0) {
            context.conversationHistory = messages
                .map((m) => `**${m.role.toUpperCase()}**: ${m.content}`)
                .join("\n\n");
        }
    }
    // Load plan from workspace
    context.planContent = loadFileContent("/workspace/.ai/plan.md");
    context.epicContent = loadFileContent("/workspace/.ai/epic/epic.md");
}
function loadDeveloperContext(context) {
    // Load .ai/ content for developers
    context.planContent = loadFileContent("/workspace/.ai/plan.md");
    context.epicContent = loadFileContent("/workspace/.ai/epic/epic.md");
    // Load active story
    const activeStoryPath = "/workspace/.ai/stories/active";
    if (existsSync(activeStoryPath)) {
        const files = readdirSync(activeStoryPath).filter((f) => f.endsWith(".md"));
        if (files.length > 0) {
            const storyPath = join(activeStoryPath, files[0]);
            context.activeStory = `**Datei**: ${files[0]}\n\n\`\`\`markdown\n${readFileSync(storyPath, "utf8")}\n\`\`\``;
        }
    }
}
// =============================================================================
// System Prompts
// =============================================================================
function loadSystemPrompt(role, runtimeDir) {
    // Try runtime repo first
    const runtimePath = join(runtimeDir, "roles", role, "system.md");
    if (existsSync(runtimePath)) {
        return readFileSync(runtimePath, "utf8");
    }
    // Fall back to built-in defaults
    return getDefaultSystemPrompt(role);
}
function getDefaultSystemPrompt(role) {
    const prompts = {
        "project-manager": `Du bist der Project Manager im Coding Swarm System.

## KRITISCH: Was du NIEMALS tun darfst

**DU BIST NUR FUER PLANUNG UND DELEGATION ZUSTAENDIG. DU IMPLEMENTIERST NIEMALS SELBST.**

VERBOTEN:
- KEIN Code schreiben oder aendern (ausser .ai/ Dateien)
- KEINE direkten Git-Befehle (ausser via erlaubte Scripts)
- KEIN Task-Tool verwenden (keine Sub-Agents spawnen)
- KEINE Bash-Befehle ausser die erlaubten Scripts

## Erlaubte Scripts

Du darfst NUR diese Scripts aus $RUNTIME_DIR/scripts/project-manager/ ausfuehren:
- delegate-task.sh - Arbeit an Developer delegieren
- send-message.sh - Nachricht an User senden
- update-plan.sh - Plan committen
- request-clarification.sh - User um Klaerung bitten
- create-epic.sh - Neues Epic anlegen
- create-story.sh - Neue Story anlegen
- complete-story.sh - Story abschliessen

## Workflow

Bei USER_MESSAGE: Antworte, dann delegiere falls noetig.
Bei TASK_COMPLETED: Update Plan, delegiere naechsten Step.
Bei neuem Projekt: Erstelle Plan, informiere User, delegiere Step 1.`,
        developer: `Du bist ein Developer im Coding Swarm System.

## Deine Rolle

Du implementierst User Stories gemaess den Akzeptanzkriterien.

## Kontext

Deine aktuelle Aufgabe findest du in:
- .ai/stories/active/ - Die zu implementierende Story
- .ai/context/ - Architektur, Konventionen, Tech-Stack

## Workflow

1. Lies die Story-Datei in .ai/stories/active/
2. Verstehe die Akzeptanzkriterien
3. Implementiere die Loesung
4. Schreibe Tests falls gefordert
5. Aktualisiere die Story-Datei (Implementation Notes)
6. Committe und pushe deine Aenderungen

## Commit-Format

[E001-S001] Kurze Beschreibung

- Detail 1
- Detail 2

Generated with Claude Code

## Wichtige Regeln

1. **Bleib auf deinem Branch**: story/E{NNN}-S{NNN}-...
2. **Merge NIEMALS selbst**: Das macht der Project Manager
3. **Pushe IMMER am Ende**: Dein Container ist ephemer
4. **Halte dich an Konventionen**: Siehe .ai/context/conventions.md
5. **Aktualisiere die Story**: Fuege Implementation Notes hinzu`,
        reviewer: `Du bist ein Code Reviewer im Coding Swarm System.

## Deine Rolle

Du pruefst Code auf Qualitaet, Sicherheit und Konformitaet mit den Projektstandards.

## Workflow

1. Lies die zu reviewende Story in .ai/stories/active/
2. Untersuche die Code-Aenderungen
3. Pruefe gegen die Akzeptanzkriterien
4. Dokumentiere Findings in .ai/reviews/
5. Entscheide: APPROVE, REQUEST_CHANGES, oder REJECT

## Review-Checkliste

- [ ] Code erfuellt Akzeptanzkriterien
- [ ] Keine offensichtlichen Bugs
- [ ] Keine Security-Probleme
- [ ] Code folgt Projektkonventionen
- [ ] Tests vorhanden und sinnvoll
- [ ] Keine ueberfluessigen Aenderungen

## Output

Erstelle eine Review-Datei in .ai/reviews/ mit:
- Zusammenfassung
- Gefundene Issues
- Empfehlung (APPROVE/REQUEST_CHANGES/REJECT)`,
    };
    return prompts[role] || prompts.developer;
}
// =============================================================================
// Section Builders
// =============================================================================
function buildProjectContext(context) {
    const parts = [];
    // Database project info (for project-manager)
    if (context.project) {
        parts.push(`### Projekt (aus Datenbank)

- **ID**: ${context.project.id}
- **Name**: ${context.project.name}
- **Repository**: ${context.project.repo_url}
- **Default Branch**: ${context.project.default_branch}
- **Integration Branch**: ${context.project.integration_branch || "nicht gesetzt"}
- **Status**: ${context.project.status}
- **Epic**: ${context.project.current_epic || "nicht definiert"}`);
    }
    // Epic from .ai/
    if (context.epicContent) {
        parts.push(`### Aktuelles Epic

\`\`\`markdown
${context.epicContent}
\`\`\``);
    }
    // Plan from .ai/
    if (context.planContent) {
        parts.push(`### Aktueller Plan

\`\`\`markdown
${context.planContent}
\`\`\``);
    }
    else if (context.role === "project-manager") {
        parts.push(`### Plan

Es existiert noch kein Plan (.ai/plan.md). Falls dies ein neues Projekt ist, erstelle einen Plan basierend auf dem Epic.`);
    }
    // Context files from .ai/context/
    const contextDir = "/workspace/.ai/context";
    if (existsSync(contextDir)) {
        const files = readdirSync(contextDir).filter((f) => f.endsWith(".md"));
        for (const file of files.slice(0, 3)) {
            // Limit to 3 files
            const content = readFileSync(join(contextDir, file), "utf8");
            const name = file.replace(".md", "");
            parts.push(`### ${name}

${content.slice(0, 2000)}${content.length > 2000 ? "\n...(truncated)" : ""}`);
        }
    }
    if (parts.length === 0)
        return null;
    return `## Projekt-Kontext\n\n${parts.join("\n\n")}`;
}
function buildTriggerSection(trigger) {
    let content;
    switch (trigger.type) {
        case "USER_MESSAGE":
            content = `**User-Nachricht**: Der User hat eine neue Nachricht geschickt. Lies die Conversation und antworte angemessen.`;
            break;
        case "TASK_COMPLETED":
            content = `**Task abgeschlossen**: ${trigger.taskType} Task (${trigger.taskId})
- Erfolg: ${trigger.success ? "Ja" : "Nein"}
- Zusammenfassung: ${trigger.summary || "keine"}
- Branch: ${trigger.branch || "keiner"}`;
            break;
        case "INITIAL":
        default:
            content = `**Initialer Run**: Dies ist der erste Run fuer dieses Projekt oder ein manueller Trigger.`;
    }
    return `## Ausloeser dieses Runs\n\n${content}`;
}
function buildTaskSection(context) {
    // If there's a direct task prompt, use it
    if (context.taskPrompt) {
        return `## Deine Aufgabe\n\n${context.taskPrompt}`;
    }
    // Otherwise, generate task based on trigger type
    if (context.role === "project-manager" && context.trigger) {
        return `## Deine Aufgabe\n\n${getProjectManagerTask(context.trigger, Boolean(context.conversationHistory))}`;
    }
    if (context.role === "developer") {
        return `## Deine Aufgabe

Implementiere die aktive Story (siehe oben). Falls keine Story aktiv ist, warte auf Anweisungen.

1. Lies die Story-Anforderungen
2. Implementiere die Loesung
3. Aktualisiere die Implementation Notes in der Story-Datei
4. Committe und pushe alle Aenderungen`;
    }
    if (context.role === "reviewer") {
        return `## Deine Aufgabe

Fuehre ein Code Review fuer die aktive Story durch.

1. Untersuche die Aenderungen
2. Pruefe gegen Akzeptanzkriterien
3. Dokumentiere dein Review in .ai/reviews/`;
    }
    return `## Deine Aufgabe\n\nKeine spezifische Aufgabe angegeben.`;
}
function getProjectManagerTask(trigger, hasConversation) {
    if (trigger.type === "USER_MESSAGE") {
        return `Lies die Conversation oben und antworte auf die letzte User-Nachricht.

1. Verstehe was der User moechte
2. Sende eine Antwort mit send-message.sh
3. Falls Code-Arbeit noetig ist, delegiere mit delegate-task.sh
4. Falls der Plan angepasst werden muss, aktualisiere .ai/plan.md`;
    }
    if (trigger.type === "TASK_COMPLETED") {
        if (trigger.success) {
            return `Der ${trigger.taskType} Task war erfolgreich. Entscheide:

1. Ist ein Folge-Task noetig? (z.B. nach CODE kommt oft MERGE)
2. Muss der Plan aktualisiert werden?
3. Soll der User informiert werden?

Fuehre die passenden Aktionen aus.`;
        }
        else {
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
3. Starte mit dem ersten Schritt (delegate-task)

Falls kein Epic definiert ist, warte auf User-Input.`;
}
// =============================================================================
// Utilities
// =============================================================================
function loadFileContent(path) {
    if (existsSync(path)) {
        return readFileSync(path, "utf8");
    }
    return undefined;
}
// =============================================================================
// Entry Point
// =============================================================================
main().catch((err) => {
    console.error(`Fatal error: ${err}`);
    process.exit(1);
});
//# sourceMappingURL=generate-prompt.js.map