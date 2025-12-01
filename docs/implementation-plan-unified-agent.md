# Implementierungsplan: Unified Agent Architecture

## Übersicht

Dieses Dokument beschreibt die Umstellung von der aktuellen Zwei-Image-Architektur (Red/Green) auf eine einheitliche Agent-Architektur mit rollenbasierter Konfiguration.

**Ziele:**
- Ein Docker Image für alle Agent-Rollen
- Laufzeitumgebung (Prompts, Skripte) aus separatem Runtime-Repo
- Professionelle Projektverwaltung im `.ai/` Verzeichnis
- Klare Branching-Strategie mit Epic/Story-Struktur
- GitHub als primäre Kontext-Quelle

---

## Implementierungs-Status

| Phase | Beschreibung | Status |
|-------|--------------|--------|
| Phase 1 | Runtime-Repo erstellen | ABGESCHLOSSEN |
| Phase 2 | Unified Agent Image | ABGESCHLOSSEN |
| Phase 3 | .ai/ Struktur | ABGESCHLOSSEN |
| Phase 4 | Spawning Engine anpassen | ABGESCHLOSSEN |
| Phase 5 | Migration bestehender Services | AUSSTEHEND |
| Phase 6 | Cockpit-Anpassungen | AUSSTEHEND (niedrige Prio) |

**Stand:** 2025-12-01

### Erstellte Dateien (Phase 2-4)

```
services/agent/                      # Unified Agent
├── Dockerfile                       # Multi-stage build
├── entrypoint.sh                    # 8-Schritt Initialisierung
├── templates/                       # Fallback-Templates
│   ├── ai-readme.md
│   ├── epic.md
│   ├── story.md
│   └── review.md
└── tools/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── config.ts                # Rollenbasierte Konfiguration
        ├── db/supabase.ts           # Datenbank-Client
        ├── generate-prompt.ts       # Unified Prompt Builder
        ├── create-task.ts           # Task-Delegation CLI
        ├── create-story.ts          # Story-Erstellung CLI
        ├── init-ai-structure.ts     # .ai/ Initialisierung CLI
        ├── send-message.ts          # Message-Sending CLI
        └── pause-project.ts         # Project-Pause CLI

services/spawning-engine/src/
├── config.ts                        # + agentImage, runtimeRepo, runtimeBranch
└── k8s/jobs.ts                      # + determineRole(), buildUnifiedAgentEnv()
```

---

## Phase 1: Runtime-Repo erstellen ABGESCHLOSSEN

**Dauer:** ~2-3 Stunden
**Priorität:** Hoch (Grundlage für alles weitere)

### 1.1 Neues Repository anlegen

```bash
# Repository: coding-swarm-runtime
gh repo create tobiaswaggoner/coding-swarm-runtime --public --description "Runtime environment for Coding Swarm agents"
```

### 1.2 Verzeichnisstruktur

```
coding-swarm-runtime/
├── README.md
├── VERSION                      # Semver für Runtime-Version
│
├── roles/                       # Rollenspezifische Konfiguration
│   ├── project-manager/
│   │   ├── system.md           # System-Prompt für Project Manager
│   │   ├── capabilities.md     # Erlaubte/Verbotene Aktionen
│   │   └── workflow.md         # Workflow-Beschreibung
│   │
│   ├── developer/
│   │   ├── system.md           # System-Prompt für Developer
│   │   ├── capabilities.md
│   │   ├── conventions.md      # Coding-Richtlinien
│   │   └── commit-style.md     # Commit-Message-Format
│   │
│   └── reviewer/
│       ├── system.md           # System-Prompt für Reviewer
│       ├── capabilities.md
│       └── checklist.md        # Review-Checkliste
│
├── scripts/                     # Bash-Skripte für Agents
│   ├── common/
│   │   ├── setup-git.sh        # Git-Konfiguration
│   │   ├── github-context.sh   # GitHub-Status sammeln
│   │   └── validate-env.sh     # Umgebungsvariablen prüfen
│   │
│   ├── project-manager/
│   │   ├── delegate-task.sh    # Task an Developer delegieren
│   │   ├── send-message.sh     # Nachricht an User
│   │   ├── update-plan.sh      # Plan committen
│   │   ├── request-clarification.sh
│   │   ├── create-epic.sh      # Epic-Branch + Struktur anlegen
│   │   ├── create-story.sh     # Story-Datei + Branch anlegen
│   │   └── complete-story.sh   # Story abschließen + verschieben
│   │
│   └── developer/
│       ├── start-story.sh      # Story-Branch auschecken
│       ├── commit-progress.sh  # Fortschritt committen
│       └── complete-work.sh    # Arbeit abschließen + pushen
│
├── templates/                   # Vorlagen für .ai/ Dateien
│   ├── epic.md.tpl
│   ├── story.md.tpl
│   ├── review.md.tpl
│   └── ai-readme.md.tpl
│
├── prompts/                     # Prompt-Bausteine
│   ├── context/
│   │   ├── github-status.md    # Template für GitHub-Kontext
│   │   ├── project-info.md     # Template für Projekt-Info
│   │   └── story-context.md    # Template für Story-Kontext
│   │
│   └── instructions/
│       ├── implement-story.md
│       ├── review-code.md
│       ├── fix-issue.md
│       └── create-pr.md
│
└── tools/                       # TypeScript CLI-Tools
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── generate-prompt.ts   # Prompt-Builder (vereinheitlicht)
        ├── parse-story.ts       # Story-Datei parsen
        ├── github-context.ts    # GitHub-API Wrapper
        └── db/
            └── supabase.ts      # Datenbank-Client
```

### 1.3 System-Prompts erstellen

**roles/project-manager/system.md:**
```markdown
Du bist der Project Manager im Coding Swarm System.

## Deine Rolle

Du planst und koordinierst die Entwicklungsarbeit. Du implementierst NIEMALS selbst.

## Konventionen

### Branch-Namensgebung
- Epic-Branch: `feature/E{NNN}-{kurzer-name}`
- Story-Branch: `story/E{NNN}-S{NNN}-{kurzer-name}`

Beispiele:
- `feature/E001-snake-game`
- `story/E001-S001-initialize-next-app`
- `story/E001-S002-implement-game-loop`

### Story-IDs
- Epic-IDs sind vierstellig: E001, E002, ...
- Story-IDs sind vierstellig: S001, S002, ...
- IDs sind pro Projekt fortlaufend

## Erlaubte Aktionen

Du darfst NUR diese Skripte ausführen:

| Skript | Zweck |
|--------|-------|
| `$RUNTIME/scripts/project-manager/delegate-task.sh` | Arbeit an Developer delegieren |
| `$RUNTIME/scripts/project-manager/send-message.sh` | Nachricht an User senden |
| `$RUNTIME/scripts/project-manager/update-plan.sh` | Plan committen |
| `$RUNTIME/scripts/project-manager/request-clarification.sh` | User um Klärung bitten |
| `$RUNTIME/scripts/project-manager/create-epic.sh` | Neues Epic anlegen |
| `$RUNTIME/scripts/project-manager/create-story.sh` | Neue Story anlegen |
| `$RUNTIME/scripts/project-manager/complete-story.sh` | Story abschließen |

## Verbotene Aktionen

- KEIN Code schreiben (außer .ai/ Dateien)
- KEINE direkten Git-Befehle
- KEIN Task-Tool verwenden
- KEIN Read/Grep für Code-Dateien

## Workflow

### Bei neuem Epic:
1. `create-epic.sh "E001" "Snake Game" "feature/E001-snake-game"`
2. Erstelle Stories in `.ai/stories/backlog/`
3. Aktiviere erste Story mit `create-story.sh`
4. Delegiere mit `delegate-task.sh`

### Bei Story-Completion:
1. Prüfe Ergebnis im Trigger-Kontext
2. `complete-story.sh "E001-S001"` (verschiebt nach done/, merged Branch)
3. Aktiviere nächste Story oder schließe Epic ab
```

**roles/developer/system.md:**
```markdown
Du bist ein Developer im Coding Swarm System.

## Deine Rolle

Du implementierst User Stories gemäß den Akzeptanzkriterien.

## Kontext

Deine aktuelle Aufgabe findest du in:
- `.ai/stories/active/` - Die zu implementierende Story
- `.ai/context/` - Architektur, Konventionen, Tech-Stack

## Workflow

1. Lies die Story-Datei in `.ai/stories/active/`
2. Verstehe die Akzeptanzkriterien
3. Implementiere die Lösung
4. Schreibe Tests falls gefordert
5. Aktualisiere die Story-Datei (Implementation Notes)
6. Committe und pushe deine Änderungen

## Commit-Format

```
[E001-S001] Kurze Beschreibung

- Detail 1
- Detail 2

🤖 Generated with Claude Code
```

## Wichtige Regeln

1. **Bleib auf deinem Branch**: `story/E{NNN}-S{NNN}-...`
2. **Merge NIEMALS selbst**: Das macht der Project Manager
3. **Pushe IMMER am Ende**: Dein Container ist ephemer
4. **Halte dich an Konventionen**: Siehe `.ai/context/conventions.md`
5. **Aktualisiere die Story**: Füge Implementation Notes hinzu
```

### 1.4 Skripte implementieren

**scripts/project-manager/create-epic.sh:**
```bash
#!/bin/bash
set -e

EPIC_ID="$1"      # z.B. "E001"
EPIC_NAME="$2"    # z.B. "Snake Game"
EPIC_BRANCH="$3"  # z.B. "feature/E001-snake-game"

if [ -z "$EPIC_ID" ] || [ -z "$EPIC_NAME" ]; then
    echo "Usage: create-epic.sh <epic-id> <epic-name> [branch-name]"
    echo "Example: create-epic.sh E001 'Snake Game' 'feature/E001-snake-game'"
    exit 1
fi

# Default branch name
if [ -z "$EPIC_BRANCH" ]; then
    EPIC_BRANCH="feature/${EPIC_ID}-$(echo "$EPIC_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"
fi

echo "Creating Epic: $EPIC_ID - $EPIC_NAME"
echo "Branch: $EPIC_BRANCH"

# 1. Create .ai structure if not exists
mkdir -p .ai/epic
mkdir -p .ai/stories/{active,backlog,done}
mkdir -p .ai/context
mkdir -p .ai/reviews

# 2. Create epic.md from template
cat > ".ai/epic/epic.md" << EOF
# Epic $EPIC_ID: $EPIC_NAME

## Status
- **Phase**: PLANNING | IN_PROGRESS | REVIEW | DONE
- **Branch**: $EPIC_BRANCH
- **Created**: $(date -Iseconds)

## Beschreibung
<!-- Was soll erreicht werden? -->

## Akzeptanzkriterien
- [ ] Kriterium 1
- [ ] Kriterium 2

## Stories
| ID | Name | Status | Branch |
|----|------|--------|--------|
<!-- Wird automatisch aktualisiert -->

## Notizen
<!-- Zusätzliche Informationen -->
EOF

# 3. Create/checkout epic branch
git checkout -b "$EPIC_BRANCH" 2>/dev/null || git checkout "$EPIC_BRANCH"

# 4. Commit the structure
git add .ai/
git commit -m "[$EPIC_ID] Initialize epic: $EPIC_NAME

- Created .ai/ directory structure
- Created epic.md

🤖 Generated with Claude Code"

git push -u origin "$EPIC_BRANCH"

echo "✅ Epic $EPIC_ID created successfully"
echo "   Branch: $EPIC_BRANCH"
echo "   Next: Create stories with create-story.sh"
```

**scripts/project-manager/create-story.sh:**
```bash
#!/bin/bash
set -e

EPIC_ID="$1"       # z.B. "E001"
STORY_ID="$2"      # z.B. "S001"
STORY_NAME="$3"    # z.B. "Initialize Next.js App"
STORY_DESC="$4"    # Optionale Beschreibung

if [ -z "$EPIC_ID" ] || [ -z "$STORY_ID" ] || [ -z "$STORY_NAME" ]; then
    echo "Usage: create-story.sh <epic-id> <story-id> <story-name> [description]"
    echo "Example: create-story.sh E001 S001 'Initialize Next.js App'"
    exit 1
fi

FULL_ID="${EPIC_ID}-${STORY_ID}"
BRANCH_NAME="story/${FULL_ID}-$(echo "$STORY_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | head -c 30)"
STORY_FILE=".ai/stories/backlog/${FULL_ID}-$(echo "$STORY_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-').md"

echo "Creating Story: $FULL_ID - $STORY_NAME"

# Create story file from template
cat > "$STORY_FILE" << EOF
# Story $FULL_ID: $STORY_NAME

## Status
- **Phase**: BACKLOG
- **Branch**: $BRANCH_NAME
- **Epic**: $EPIC_ID
- **Created**: $(date -Iseconds)

## User Story
${STORY_DESC:-"Als [Rolle] möchte ich [Funktion], damit [Nutzen]."}

## Akzeptanzkriterien
- [ ] Kriterium 1
- [ ] Kriterium 2
- [ ] Kriterium 3

## Technische Details
<!-- Hinweise zur Implementierung -->

## Implementation Notes
<!-- Wird vom Developer ausgefüllt -->

## Review Notes
<!-- Wird vom Reviewer ausgefüllt -->
EOF

git add "$STORY_FILE"
git commit -m "[$FULL_ID] Create story: $STORY_NAME

🤖 Generated with Claude Code"
git push

echo "✅ Story $FULL_ID created"
echo "   File: $STORY_FILE"
echo "   Branch (will be): $BRANCH_NAME"
```

**scripts/project-manager/delegate-task.sh:**
```bash
#!/bin/bash
set -e

TASK_DESCRIPTION="$1"
TARGET_BRANCH="$2"
STORY_ID="$3"  # Optional: z.B. "E001-S001"

if [ -z "$TASK_DESCRIPTION" ]; then
    echo "Usage: delegate-task.sh <task-description> [target-branch] [story-id]"
    exit 1
fi

# Build the task prompt
TASK_PROMPT="$TASK_DESCRIPTION"

# Add story context if provided
if [ -n "$STORY_ID" ]; then
    STORY_FILE=$(find .ai/stories -name "${STORY_ID}*.md" 2>/dev/null | head -1)
    if [ -n "$STORY_FILE" ]; then
        TASK_PROMPT="$TASK_PROMPT

Lies die Story-Details in: $STORY_FILE"
    fi
fi

# Call the CLI tool to create the task
node "$RUNTIME_DIR/tools/dist/create-task.js" \
    --prompt "$TASK_PROMPT" \
    --branch "$TARGET_BRANCH" \
    --role "developer"

echo "✅ Task delegated to Developer"
```

**scripts/common/github-context.sh:**
```bash
#!/bin/bash
# Sammelt GitHub-Kontext für den Agent

echo "## GitHub Status"
echo ""
echo "### Repository"
echo "- **URL**: $(git remote get-url origin)"
echo "- **Branch**: $(git branch --show-current)"
echo "- **Last Commit**: $(git log -1 --format='%h %s')"
echo ""

echo "### Offene Branches"
echo "\`\`\`"
git branch -r | grep -E "(feature/E|story/E)" | head -10 || echo "Keine Epic/Story Branches"
echo "\`\`\`"
echo ""

echo "### Letzte Commits (dieser Branch)"
echo "\`\`\`"
git log --oneline -5
echo "\`\`\`"
echo ""

echo "### Offene Pull Requests"
if command -v gh &> /dev/null; then
    gh pr list --limit 5 --json number,title,headRefName,state 2>/dev/null || echo "Keine PRs oder gh nicht verfügbar"
else
    echo "gh CLI nicht verfügbar"
fi
echo ""

echo "### CI Status"
if command -v gh &> /dev/null; then
    gh run list --limit 3 --json status,conclusion,name,headBranch 2>/dev/null || echo "Keine Runs oder gh nicht verfügbar"
else
    echo "gh CLI nicht verfügbar"
fi
```

---

## Phase 2: Unified Agent Image ABGESCHLOSSEN

**Dauer:** ~3-4 Stunden
**Priorität:** Hoch

### 2.1 Neuer Dockerfile

**services/agent/Dockerfile:**
```dockerfile
# =============================================================================
# Coding Swarm - Unified Agent Image
# =============================================================================
# Ein Image für alle Agent-Rollen (project-manager, developer, reviewer)
# Rolle wird zur Laufzeit via AGENT_ROLE Environment Variable bestimmt
# =============================================================================

FROM tobiaswaggoner/coding-swarm-base:latest

ARG BUILD_TIMESTAMP=unknown
ARG GIT_COMMIT=unknown

LABEL org.opencontainers.image.title="Coding Swarm Agent"
LABEL org.opencontainers.image.description="Unified agent for all roles"
LABEL org.opencontainers.image.version="${BUILD_TIMESTAMP}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"

# Install additional tools
USER root
RUN npm install -g typescript tsx

# Copy entrypoint and tools
COPY entrypoint.sh /app/entrypoint.sh
COPY tools/ /app/tools/
RUN chmod +x /app/entrypoint.sh && \
    cd /app/tools && npm ci && npm run build

# Switch to non-root user
USER aiworker
WORKDIR /workspace

# Environment defaults
ENV AGENT_ROLE="developer"
ENV RUNTIME_REPO="https://github.com/tobiaswaggoner/coding-swarm-runtime"
ENV RUNTIME_BRANCH="main"
ENV RUNTIME_DIR="/runtime"

ENTRYPOINT ["/app/entrypoint.sh"]
```

### 2.2 Neuer Entrypoint

**services/agent/entrypoint.sh:**
```bash
#!/bin/bash
set -e

echo "=========================================="
echo "  Coding Swarm - Unified Agent"
echo "=========================================="
echo "  Role: ${AGENT_ROLE:-developer}"
echo "  Build: ${BUILD_TIMESTAMP:-unknown}"
echo "=========================================="

# ===========================================
# [1/8] SECURITY CHECKS
# ===========================================

echo ""
echo "[1/8] Security validation..."

if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "FATAL: ANTHROPIC_API_KEY detected!"
    exit 1
fi

# ===========================================
# [2/8] VALIDATE REQUIRED SECRETS
# ===========================================

echo ""
echo "[2/8] Validating secrets..."

MISSING=0

[ -z "$CLAUDE_CODE_OAUTH_TOKEN" ] && echo "  [MISSING] CLAUDE_CODE_OAUTH_TOKEN" && MISSING=1
[ -z "$GITHUB_TOKEN" ] && echo "  [MISSING] GITHUB_TOKEN" && MISSING=1

# Project Manager needs Supabase
if [ "$AGENT_ROLE" = "project-manager" ]; then
    [ -z "$SUPABASE_URL" ] && echo "  [MISSING] SUPABASE_URL" && MISSING=1
    [ -z "$SUPABASE_KEY" ] && echo "  [MISSING] SUPABASE_KEY" && MISSING=1
    [ -z "$PROJECT_ID" ] && echo "  [MISSING] PROJECT_ID" && MISSING=1
fi

[ "$MISSING" -eq 1 ] && echo "FATAL: Missing required secrets" && exit 1
echo "  [OK] All required secrets present"

# ===========================================
# [3/8] CONFIGURE GIT CREDENTIALS
# ===========================================

echo ""
echo "[3/8] Configuring Git..."

chmod 700 "$HOME"
git config --global user.email "${GIT_USER_EMAIL:-ai-agent@coding-swarm.local}"
git config --global user.name "${GIT_USER_NAME:-Coding Swarm Agent}"

# GIT_ASKPASS setup
GIT_ASKPASS_SCRIPT="$HOME/.git-askpass.sh"
cat > "$GIT_ASKPASS_SCRIPT" << 'EOF'
#!/bin/bash
echo "$GITHUB_TOKEN"
EOF
chmod 700 "$GIT_ASKPASS_SCRIPT"

export GIT_ASKPASS="$GIT_ASKPASS_SCRIPT"
export GIT_TERMINAL_PROMPT=0
export GH_TOKEN="$GITHUB_TOKEN"

git config --global url."https://x-access-token@github.com/".insteadOf "https://github.com/"

echo "  [OK] Git configured"

# ===========================================
# [4/8] CLONE RUNTIME REPO
# ===========================================

echo ""
echo "[4/8] Setting up runtime environment..."

RUNTIME_DIR="${RUNTIME_DIR:-/runtime}"

if [ -n "$RUNTIME_REPO" ]; then
    echo "  Cloning: $RUNTIME_REPO (branch: ${RUNTIME_BRANCH:-main})"
    git clone --depth 1 --branch "${RUNTIME_BRANCH:-main}" "$RUNTIME_REPO" "$RUNTIME_DIR"

    # Make scripts executable
    chmod +x "$RUNTIME_DIR/scripts/"*/*.sh 2>/dev/null || true
    chmod +x "$RUNTIME_DIR/scripts/common/"*.sh 2>/dev/null || true

    # Build tools if needed
    if [ -f "$RUNTIME_DIR/tools/package.json" ]; then
        cd "$RUNTIME_DIR/tools"
        npm ci --silent
        npm run build --silent
        cd /workspace
    fi

    echo "  [OK] Runtime ready at $RUNTIME_DIR"
else
    echo "  [SKIP] No RUNTIME_REPO set, using built-in defaults"
fi

export RUNTIME_DIR

# ===========================================
# [5/8] CLONE TARGET REPO
# ===========================================

echo ""
echo "[5/8] Cloning target repository..."

if [ -n "$TARGET_REPO" ]; then
    echo "  Cloning: $TARGET_REPO"
    git clone "$TARGET_REPO" /workspace
    cd /workspace

    if [ -n "$TARGET_BRANCH" ]; then
        echo "  Checking out: $TARGET_BRANCH"
        git fetch origin

        if git ls-remote --exit-code --heads origin "$TARGET_BRANCH" >/dev/null 2>&1; then
            git checkout -b "$TARGET_BRANCH" "origin/$TARGET_BRANCH" 2>/dev/null || git checkout "$TARGET_BRANCH"
        else
            echo "  [INFO] Branch does not exist, creating..."
            git checkout -b "$TARGET_BRANCH"
            git push -u origin "$TARGET_BRANCH"
        fi
    fi

    echo "  [OK] Repository ready"
else
    echo "  [SKIP] No TARGET_REPO set"
    mkdir -p /workspace
    cd /workspace
fi

# ===========================================
# [6/8] COLLECT GITHUB CONTEXT
# ===========================================

echo ""
echo "[6/8] Collecting GitHub context..."

GITHUB_CONTEXT=""
if [ -f "$RUNTIME_DIR/scripts/common/github-context.sh" ]; then
    GITHUB_CONTEXT=$("$RUNTIME_DIR/scripts/common/github-context.sh" 2>/dev/null || echo "GitHub context unavailable")
    echo "  [OK] GitHub context collected"
else
    echo "  [SKIP] No github-context.sh found"
fi

export GITHUB_CONTEXT

# ===========================================
# [7/8] GENERATE PROMPT
# ===========================================

echo ""
echo "[7/8] Generating prompt..."

# Determine prompt generation method based on role
if [ -f "$RUNTIME_DIR/tools/dist/generate-prompt.js" ]; then
    PROMPT=$(node "$RUNTIME_DIR/tools/dist/generate-prompt.js")
elif [ -f "/app/tools/dist/generate-prompt.js" ]; then
    PROMPT=$(node "/app/tools/dist/generate-prompt.js")
else
    # Fallback: Use TASK_PROMPT directly with basic system prompt
    SYSTEM_PROMPT=""
    if [ -f "$RUNTIME_DIR/roles/$AGENT_ROLE/system.md" ]; then
        SYSTEM_PROMPT=$(cat "$RUNTIME_DIR/roles/$AGENT_ROLE/system.md")
    fi

    PROMPT="$SYSTEM_PROMPT

## Deine Aufgabe

$TASK_PROMPT

## GitHub Kontext

$GITHUB_CONTEXT"
fi

if [ -z "$PROMPT" ]; then
    echo "FATAL: Failed to generate prompt"
    exit 1
fi

echo "  [OK] Prompt generated ($(echo "$PROMPT" | wc -c) bytes)"

# ===========================================
# [8/8] EXECUTE CLAUDE CODE
# ===========================================

echo ""
echo "[8/8] Starting Claude Code..."
echo "=========================================="

OUTPUT_FORMAT="${OUTPUT_FORMAT:-stream-json}"

if [ "$OUTPUT_FORMAT" = "stream-json" ]; then
    claude -p "$PROMPT" \
        --dangerously-skip-permissions \
        --output-format "$OUTPUT_FORMAT" \
        --verbose
else
    claude -p "$PROMPT" \
        --dangerously-skip-permissions \
        --output-format "$OUTPUT_FORMAT"
fi

echo ""
echo "=========================================="
echo "Agent completed!"
```

### 2.3 Prompt-Generator aktualisieren

**services/agent/tools/src/generate-prompt.ts:**
```typescript
#!/usr/bin/env node
/**
 * Unified Prompt Generator for all Agent roles
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

interface PromptContext {
  role: string;
  runtimeDir: string;
  projectId?: string;
  targetRepo?: string;
  targetBranch?: string;
  taskPrompt?: string;
  triggeredByTaskId?: string;
  conversationId?: string;
  githubContext?: string;
}

async function main() {
  const ctx: PromptContext = {
    role: process.env.AGENT_ROLE || "developer",
    runtimeDir: process.env.RUNTIME_DIR || "/runtime",
    projectId: process.env.PROJECT_ID,
    targetRepo: process.env.TARGET_REPO,
    targetBranch: process.env.TARGET_BRANCH,
    taskPrompt: process.env.TASK_PROMPT,
    triggeredByTaskId: process.env.TRIGGERED_BY_TASK_ID,
    conversationId: process.env.CONVERSATION_ID,
    githubContext: process.env.GITHUB_CONTEXT,
  };

  const sections: string[] = [];

  // 1. System Prompt (role-specific)
  const systemPromptPath = join(ctx.runtimeDir, "roles", ctx.role, "system.md");
  if (existsSync(systemPromptPath)) {
    sections.push(readFileSync(systemPromptPath, "utf8"));
  } else {
    sections.push(getDefaultSystemPrompt(ctx.role));
  }

  // 2. Project Context (from .ai/)
  const projectContext = loadProjectContext();
  if (projectContext) {
    sections.push(projectContext);
  }

  // 3. Active Story (for developers)
  if (ctx.role === "developer") {
    const storyContext = loadActiveStory();
    if (storyContext) {
      sections.push(storyContext);
    }
  }

  // 4. GitHub Context
  if (ctx.githubContext) {
    sections.push(`\n## GitHub Kontext\n\n${ctx.githubContext}`);
  }

  // 5. Trigger Context (for project-manager)
  if (ctx.role === "project-manager" && ctx.triggeredByTaskId) {
    const triggerContext = await loadTriggerContext(ctx);
    if (triggerContext) {
      sections.push(triggerContext);
    }
  }

  // 6. Conversation History (if applicable)
  if (ctx.conversationId) {
    const conversation = await loadConversation(ctx);
    if (conversation) {
      sections.push(conversation);
    }
  }

  // 7. Task Prompt
  if (ctx.taskPrompt) {
    sections.push(`\n## Aktuelle Aufgabe\n\n${ctx.taskPrompt}`);
  }

  console.log(sections.join("\n\n---\n\n"));
}

function loadProjectContext(): string | null {
  const sections: string[] = [];

  // Epic info
  const epicPath = "/workspace/.ai/epic/epic.md";
  if (existsSync(epicPath)) {
    sections.push(`### Aktuelles Epic\n\n\`\`\`markdown\n${readFileSync(epicPath, "utf8")}\n\`\`\``);
  }

  // Context files
  const contextDir = "/workspace/.ai/context";
  if (existsSync(contextDir)) {
    const files = readdirSync(contextDir).filter(f => f.endsWith(".md"));
    for (const file of files) {
      const content = readFileSync(join(contextDir, file), "utf8");
      const name = file.replace(".md", "");
      sections.push(`### ${name}\n\n${content}`);
    }
  }

  if (sections.length === 0) return null;
  return `## Projekt-Kontext\n\n${sections.join("\n\n")}`;
}

function loadActiveStory(): string | null {
  const activeDir = "/workspace/.ai/stories/active";
  if (!existsSync(activeDir)) return null;

  const files = readdirSync(activeDir).filter(f => f.endsWith(".md"));
  if (files.length === 0) return null;

  const storyPath = join(activeDir, files[0]);
  const content = readFileSync(storyPath, "utf8");

  return `## Aktive Story\n\n**Datei**: ${files[0]}\n\n\`\`\`markdown\n${content}\n\`\`\``;
}

async function loadTriggerContext(ctx: PromptContext): Promise<string | null> {
  if (!ctx.triggeredByTaskId || !process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return null;
  }

  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  const { data: task } = await client
    .from("tasks")
    .select("*")
    .eq("id", ctx.triggeredByTaskId)
    .single();

  if (!task) return null;

  const result = task.result || {};
  return `## Trigger-Kontext

**Typ**: ${task.task_type || "UNKNOWN"}
**Task-ID**: ${task.id}
**Status**: ${result.success ? "Erfolgreich" : "Fehlgeschlagen"}
**Zusammenfassung**: ${result.summary || "keine"}
**Branch**: ${result.branch || "keiner"}`;
}

async function loadConversation(ctx: PromptContext): Promise<string | null> {
  if (!ctx.conversationId || !process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return null;
  }

  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  const { data: messages } = await client
    .from("messages")
    .select("*")
    .eq("conversation_id", ctx.conversationId)
    .order("created_at", { ascending: true });

  if (!messages || messages.length === 0) return null;

  const formatted = messages
    .map(m => `**${m.role.toUpperCase()}**: ${m.content}`)
    .join("\n\n");

  return `## Conversation\n\n${formatted}`;
}

function getDefaultSystemPrompt(role: string): string {
  const prompts: Record<string, string> = {
    "project-manager": `Du bist der Project Manager im Coding Swarm System.
Du planst und koordinierst. Du implementierst NIEMALS selbst.
Delegiere alle Code-Arbeit an Developer.`,

    "developer": `Du bist ein Developer im Coding Swarm System.
Implementiere die aktive Story gemäß den Akzeptanzkriterien.
Committe und pushe deine Änderungen am Ende.`,

    "reviewer": `Du bist ein Code Reviewer im Coding Swarm System.
Prüfe den Code auf Qualität, Sicherheit und Konformität.
Dokumentiere deine Findings in der Review-Datei.`,
  };

  return prompts[role] || prompts["developer"];
}

main().catch(err => {
  console.error(`Error: ${err}`);
  process.exit(1);
});
```

---

## Phase 3: .ai/ Struktur implementieren ABGESCHLOSSEN

**Dauer:** ~2 Stunden
**Priorität:** Mittel

### 3.1 Templates im Runtime-Repo

**templates/ai-readme.md.tpl:**
```markdown
# .ai/ - AI Project Management

Dieses Verzeichnis enthält die Projektverwaltung für den Coding Swarm.

## Struktur

```
.ai/
├── epic/              # Aktuelles Epic
├── stories/           # User Stories
│   ├── active/        # In Bearbeitung
│   ├── backlog/       # Warteschlange
│   └── done/          # Abgeschlossen
├── context/           # Projekt-Kontext
└── reviews/           # Review-Ergebnisse
```

## Konventionen

- Epic-IDs: E001, E002, ...
- Story-IDs: S001, S002, ...
- Branch-Format: `story/E{NNN}-S{NNN}-{name}`
```

**templates/story.md.tpl:**
```markdown
# Story {{STORY_ID}}: {{STORY_NAME}}

## Status
- **Phase**: {{PHASE}}
- **Branch**: {{BRANCH}}
- **Epic**: {{EPIC_ID}}
- **Created**: {{CREATED_AT}}
- **Updated**: {{UPDATED_AT}}

## User Story

Als {{ROLE}}
möchte ich {{FEATURE}},
damit {{BENEFIT}}.

## Akzeptanzkriterien

- [ ] {{CRITERION_1}}
- [ ] {{CRITERION_2}}
- [ ] {{CRITERION_3}}

## Technische Details

{{TECHNICAL_DETAILS}}

## Implementation Notes

<!-- Vom Developer auszufüllen -->

## Review Notes

<!-- Vom Reviewer auszufüllen -->
```

### 3.2 Story-Phasen

| Phase | Bedeutung | Verzeichnis |
|-------|-----------|-------------|
| `BACKLOG` | Noch nicht begonnen | `stories/backlog/` |
| `ACTIVE` | In Bearbeitung | `stories/active/` |
| `IMPLEMENTED` | Code fertig, wartet auf Review | `stories/active/` |
| `IN_REVIEW` | Wird reviewed | `stories/active/` |
| `DONE` | Abgeschlossen und gemerged | `stories/done/` |

---

## Phase 4: Spawning Engine anpassen ABGESCHLOSSEN

**Dauer:** ~2-3 Stunden
**Priorität:** Hoch

### 4.1 Job-Erstellung anpassen

**services/spawning-engine/src/k8s/jobs.ts (Änderungen):**

```typescript
// Neue Funktion: Unified Job erstellen
export function createUnifiedJobSpec(task: Task, project: Project | null): V1Job {
  const role = determineRole(task);
  const jobName = generateJobName(task.id, role);

  const env: V1EnvVar[] = [
    // Rolle
    { name: "AGENT_ROLE", value: role },

    // Runtime
    { name: "RUNTIME_REPO", value: config.runtimeRepo },
    { name: "RUNTIME_BRANCH", value: config.runtimeBranch },

    // Target Repository
    { name: "TARGET_REPO", value: task.repo_url || project?.repo_url },
    { name: "TARGET_BRANCH", value: task.branch || project?.integration_branch },

    // Task
    { name: "TASK_PROMPT", value: task.prompt },
    { name: "TASK_ID", value: task.id },

    // Secrets
    { name: "CLAUDE_CODE_OAUTH_TOKEN", valueFrom: secretRef("coding-swarm-secrets", "CLAUDE_CODE_OAUTH_TOKEN") },
    { name: "GITHUB_TOKEN", valueFrom: secretRef("coding-swarm-secrets", "GITHUB_TOKEN") },
  ];

  // Project Manager needs additional env
  if (role === "project-manager") {
    env.push(
      { name: "PROJECT_ID", value: task.project_id },
      { name: "SUPABASE_URL", valueFrom: secretRef("spawning-engine-secrets", "SUPABASE_URL") },
      { name: "SUPABASE_KEY", valueFrom: secretRef("spawning-engine-secrets", "SUPABASE_KEY") },
      { name: "TRIGGERED_BY_TASK_ID", value: task.triggered_by_task_id },
      { name: "CONVERSATION_ID", value: task.conversation_id },
    );
  }

  return {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      name: jobName,
      namespace: config.namespace,
      labels: {
        "app": "coding-swarm-agent",
        "role": role,
        "task-id": task.id,
      },
    },
    spec: {
      ttlSecondsAfterFinished: 300,
      backoffLimit: 0,
      template: {
        spec: {
          restartPolicy: "Never",
          containers: [{
            name: "agent",
            image: config.agentImage,  // Ein Image für alle!
            env,
            resources: {
              requests: { memory: "256Mi", cpu: "100m" },
              limits: { memory: "2Gi", cpu: "1" },
            },
          }],
          securityContext: {
            runAsNonRoot: true,
            runAsUser: 1000,
          },
        },
      },
    },
  };
}

function determineRole(task: Task): string {
  // Project Manager Tasks
  if (task.addressee?.startsWith("project-mgr-")) {
    return "project-manager";
  }

  // Review Tasks
  if (task.task_type === "REVIEW") {
    return "reviewer";
  }

  // Default: Developer
  return "developer";
}
```

### 4.2 Config erweitern

**services/spawning-engine/src/config.ts (Ergänzungen):**

```typescript
export const config = {
  // ... existing config ...

  // Unified Agent Image (ersetzt JOB_IMAGE und GREEN_AGENT_IMAGE)
  agentImage: process.env.AGENT_IMAGE || "tobiaswaggoner/coding-swarm-agent:latest",

  // Runtime Repository
  runtimeRepo: process.env.RUNTIME_REPO || "https://github.com/tobiaswaggoner/coding-swarm-runtime",
  runtimeBranch: process.env.RUNTIME_BRANCH || "main",
};
```

---

## Phase 5: Migration bestehender Services

**Dauer:** ~1-2 Stunden
**Priorität:** Mittel

### 5.1 Verzeichnisstruktur umstellen

```bash
# Vorher
services/
├── red-agent/
├── green-agent/
├── cockpit/
└── spawning-engine/

# Nachher
services/
├── agent/              # Unified Agent (ersetzt red-agent + green-agent)
├── cockpit/
└── spawning-engine/

# Archivieren (nicht löschen, für Referenz)
archive/
├── red-agent/
└── green-agent/
```

### 5.2 Build-Skript anpassen

**scripts/build-and-push.sh (Änderungen):**

```bash
# Vorher
build_red_agent() { ... }
build_green_agent() { ... }

# Nachher
build_agent() {
    echo "Building Unified Agent..."
    docker build \
        -t tobiaswaggoner/coding-swarm-agent:latest \
        -f services/agent/Dockerfile \
        --build-arg BUILD_TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)" \
        --build-arg GIT_COMMIT="$(git rev-parse --short HEAD)" \
        services/agent/
}
```

---

## Phase 6: Cockpit-Anpassungen

**Dauer:** ~2-3 Stunden
**Priorität:** Niedrig (kann später erfolgen)

### 6.1 Epic/Story-Unterstützung

- Epic-Erstellung im Cockpit
- Story-Backlog-Ansicht
- Story-Status-Tracking
- Branch-Visualisierung

### 6.2 Neue API-Endpunkte

```typescript
// /api/projects/[id]/epics
GET  - Liste aller Epics
POST - Neues Epic erstellen

// /api/projects/[id]/epics/[epicId]/stories
GET  - Liste aller Stories im Epic
POST - Neue Story erstellen
PATCH - Story-Status ändern
```

---

## Implementierungs-Reihenfolge

### Sprint 1: Grundlagen (Tag 1-2)

1. **Runtime-Repo erstellen**
   - Repository anlegen
   - Basis-Struktur erstellen
   - System-Prompts für alle Rollen
   - Basis-Skripte (github-context.sh, validate-env.sh)

2. **Unified Agent Image**
   - Neuen Dockerfile erstellen
   - Entrypoint implementieren
   - Lokale Tests

### Sprint 2: Integration (Tag 3-4)

3. **Spawning Engine anpassen**
   - Job-Erstellung auf Unified Agent umstellen
   - Config erweitern
   - Tests

4. **Project Manager Skripte**
   - create-epic.sh
   - create-story.sh
   - delegate-task.sh
   - complete-story.sh

### Sprint 3: Workflow (Tag 5-6)

5. **Developer Skripte**
   - start-story.sh
   - commit-progress.sh
   - complete-work.sh

6. **.ai/ Struktur**
   - Templates finalisieren
   - Story-Format dokumentieren
   - Migration bestehender Projekte

### Sprint 4: Polish (Tag 7+)

7. **Alte Services archivieren**
8. **Dokumentation aktualisieren**
9. **Cockpit-Anpassungen** (optional)

---

## Erfolgs-Metriken

| Metrik | Vorher | Nachher |
|--------|--------|---------|
| Docker Images | 3 (base, red, green) | 2 (base, agent) |
| Code-Duplikation | ~80% in entrypoints | 0% |
| Prompt-Änderung | Docker Build nötig | Git Push reicht |
| Kontext für Agents | Minimal (nur TASK_PROMPT) | Reich (GitHub, .ai/, History) |
| Story-Tracking | Manual in plan.md | Strukturiert in .ai/stories/ |
| Branch-Chaos | Ja | Klare E{NNN}-S{NNN} Struktur |

---

## Risiken und Mitigationen

| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|-------------------|------------|
| Runtime-Repo nicht erreichbar | Niedrig | Fallback auf eingebettete Defaults |
| Breaking Changes in Runtime | Mittel | Versionierte Runtime-Branches (v1, v2) |
| Komplexerer Entrypoint | Mittel | Gute Logs, modulare Struktur |
| Migration bestehender Projekte | Hoch | Migrations-Skript, Dokumentation |

---

## Nächste Schritte

**Phasen 1-4 sind abgeschlossen.** Verbleibende Arbeiten:

1. **Phase 5: Migration** - Alte red-agent/green-agent nach archive/ verschieben
2. **Build-Skript anpassen** - scripts/build-and-push.sh für unified agent
3. **Docker Image pushen** - tobiaswaggoner/coding-swarm-agent:latest
4. **E2E-Test** - Unified Agent im Cluster testen
5. **Phase 6: Cockpit** - Epic/Story UI (optional, niedrige Priorität)
