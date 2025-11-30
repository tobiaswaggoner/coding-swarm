# Green Layer Design - Event-Driven Project Manager

## Übersicht

Der Green Layer (Project Manager) ist ein ephemerer K8s Job, der iterativ Projekte vorantreibt. Im Gegensatz zu einem langlaufenden Polling-Agent wird Green **event-driven getriggert** und terminiert nach jeder Aktion.

```
┌─────────────────────────────────────────────────────────────────┐
│                     DESIGN-PRINZIP                              │
│                                                                 │
│   Green macht sein Ding → Ändert Plan → Erstellt Task → STIRBT │
│                                                                 │
│   WICHTIG: Green führt KEINE Git-Operationen aus!              │
│            Alles läuft über Red-Tasks.                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Kritische Design-Regeln

### 1. Red darf NIEMALS mergen

Jeder Branch-Merge ist ein separater Task. Warum?

- **Review-Möglichkeit:** Branches können vor Merge geprüft werden
- **Ablehnung möglich:** Branches können verworfen werden
- **Merge-Konflikte:** Bei Parallelisierung isoliert lösbar
- **Kontrolle:** Green behält volle Steuerung

### 2. Green führt keine Git-Operationen aus - mit einer Ausnahme

Green erstellt Tasks für Red. PR-Erstellung und Merges laufen über Red-Tasks.

**Ausnahme:** Green darf `.ai/plan.md` direkt committen und pushen. Der Plan ist Green's Arbeitsbereich.

### 3. Das `.ai/` Verzeichnis ist der Projekt-Kontext

```
.ai/
├── plan.md          # Der aktuelle Plan (von Green gepflegt)
├── context.md       # (Später) Projektkontext, Architektur-Infos
├── spec.md          # (Später) Technische Spezifikation
└── ...              # Weitere Kontext-Dateien nach Bedarf
```

Der Plan muss existieren, bevor Red-Tasks gespawnt werden können. Green ist verantwortlich für das `.ai/` Verzeichnis.

### 4. Jeder Schritt = Mehrere Tasks

```
Code-Task → [Review-Task] → Merge-Task → Nächster Schritt
```

---

## Kernkonzepte

### Projekt = Repository = Green Manager (1:1:1)

| Konzept | Beschreibung |
|---------|--------------|
| **Projekt** | Eine Arbeitseinheit, identifiziert durch `project_id` |
| **Repository** | Jedes Projekt bezieht sich auf genau ein Git-Repository |
| **Green Manager** | Jedes Projekt hat genau einen Manager (`project-mgr-{project_id}`) |

Die Begriffe "Projekt" und "Project Manager" sind austauschbar.

### Addressee-Schema

```
project-mgr-{project_id}  → Green Manager Job (sequentiell pro Projekt)
worker-{type}-{uuid}      → Red Worker Job (parallel möglich)
```

### Task-Typen

| Typ | Beschreibung | Addressee-Präfix |
|-----|--------------|------------------|
| **Code-Task** | Feature implementieren | `worker-code-` |
| **Merge-Task** | Branch in Integration-Branch mergen | `worker-merge-` |
| **Review-Task** | Code-Review, Validierung | `worker-review-` |
| **Fix-Task** | Bugfixes, Korrekturen | `worker-fix-` |
| **PR-Task** | Pull Request erstellen | `worker-pr-` |
| **Validate-Task** | Build/Test-Validierung | `worker-validate-` |

---

## Workflow pro Schritt

```
┌─────────────────────────────────────────────────────────────────┐
│ WORKFLOW PRO SCHRITT                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Green erstellt CODE-Task für Red                            │
│            ↓                                                    │
│  2. Red arbeitet auf feature/step-X-timestamp                   │
│     Red pusht Branch, MERGED NICHT, stirbt                      │
│            ↓                                                    │
│  3. Engine triggert Green (Task completed)                      │
│            ↓                                                    │
│  4. Green analysiert Result                                     │
│     ┌─────────────────────────────────────────┐                 │
│     │ Entscheidung:                           │                 │
│     │ - OK → MERGE-Task erstellen             │                 │
│     │ - Unsicher → REVIEW-Task erstellen      │                 │
│     │ - Fehlgeschlagen → Retry oder Verwerfen │                 │
│     └─────────────────────────────────────────┘                 │
│            ↓                                                    │
│  5. [Optional: Red (Review) prüft Branch]                       │
│            ↓                                                    │
│  6. Green sieht Review-Result                                   │
│     - APPROVE → MERGE-Task erstellen                            │
│     - REQUEST_CHANGES → FIX-Task erstellen                      │
│     - REJECT → Branch verwerfen, neuer CODE-Task                │
│            ↓                                                    │
│  7. Red (Merge) führt Merge aus                                 │
│     Löst ggf. Konflikte, pusht, stirbt                          │
│            ↓                                                    │
│  8. Engine triggert Green (Merge completed)                     │
│            ↓                                                    │
│  9. Green sieht Merge OK                                        │
│     Markiert Schritt als DONE                                   │
│     Erstellt nächsten CODE-Task                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Trigger-Mechanismen

Green wird durch drei Ereignisse getriggert:

### 1. Red Task Completion (Primär)

```
Red Job completed/failed
       ↓
Spawning Engine erkennt Completion
       ↓
Engine liest project_id aus Task
       ↓
Engine erstellt neuen Green-Task mit:
  - addressee: project-mgr-{project_id}
  - prompt: Enthält completed_task_id + result
       ↓
Green wird gestartet, verarbeitet Ergebnis
```

### 2. Blue UI Impuls (Später)

```
User erstellt Epic in Blue UI
       ↓
Blue schreibt Task in DB:
  - addressee: project-mgr-{project_id}
  - prompt: Epic-Beschreibung
       ↓
Engine spawnt Green
```

### 3. Watchdog Timer (Fallback)

```
Alle 5 Minuten: Engine prüft
       ↓
Projekte ohne Aktivität seit X Minuten?
Keine laufenden/pending Tasks für Manager?
       ↓
Engine triggert Green als Sicherheitsnetz
```

---

## Datenmodell

### Erweiterte Tasks-Tabelle

```sql
CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Routing
    addressee       VARCHAR(255) NOT NULL,    -- Wer führt aus
    project_id      VARCHAR(255),             -- Zugehöriges Projekt

    -- Task-Typ (für Auswertung)
    task_type       VARCHAR(50),              -- CODE, MERGE, REVIEW, FIX, PR, VALIDATE

    -- Status
    status          VARCHAR(50) DEFAULT 'pending',  -- pending, running, completed, failed

    -- Aufgabe
    prompt          TEXT NOT NULL,
    repo_url        TEXT,
    branch          VARCHAR(255),             -- Arbeits-Branch für diesen Task

    -- Trigger-Info (für Green)
    triggered_by_task_id  UUID REFERENCES tasks(id),

    -- Metadaten
    created_by      VARCHAR(255),
    created_at      TIMESTAMP DEFAULT NOW(),
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,

    -- Ergebnis
    result          JSONB,
    worker_pod      VARCHAR(255)
);

-- Indices
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_pending ON tasks(addressee, status) WHERE status = 'pending';
CREATE INDEX idx_tasks_running ON tasks(addressee) WHERE status = 'running';
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
```

### Projects-Tabelle

```sql
CREATE TABLE projects (
    -- Identifikation
    id                  VARCHAR(255) PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,

    -- Repository
    repo_url            TEXT NOT NULL,
    default_branch      VARCHAR(255) DEFAULT 'main',
    integration_branch  VARCHAR(255),             -- z.B. feature/new-snake-game

    -- Status
    status              VARCHAR(50) DEFAULT 'active',
    -- active, paused, awaiting_review, completed, failed

    -- Aktuelles Epic
    current_epic        TEXT,

    -- Tracking
    last_activity       TIMESTAMP DEFAULT NOW(),
    created_at          TIMESTAMP DEFAULT NOW(),
    created_by          VARCHAR(255),

    -- Statistiken (für Blue UI)
    total_tasks         INTEGER DEFAULT 0,
    completed_tasks     INTEGER DEFAULT 0,
    failed_tasks        INTEGER DEFAULT 0,
    total_cost_usd      DECIMAL(10,4) DEFAULT 0,

    -- PR-Info (wenn awaiting_review)
    pr_url              TEXT,
    pr_number           INTEGER
);

CREATE INDEX idx_projects_active ON projects(status, last_activity)
    WHERE status = 'active';
```

---

## Spawning Engine Erweiterungen

### 1. Trigger-Logik nach Task Completion

```typescript
// engine/reaper.ts - Erweitert

async function handleTaskCompletion(task: Task, result: TaskResult, logs: string) {
  // 1. Task als completed/failed markieren
  await db.completeTask(task.id, result);
  await db.saveTaskLogs(task.id, logs);

  // 2. Projekt-Statistiken aktualisieren
  if (task.project_id) {
    await db.updateProjectStats(task.project_id, {
      lastActivity: new Date(),
      completedTasks: increment,
      totalCost: result.cost_usd
    });
  }

  // 3. Green Manager triggern (wenn Worker-Task)
  if (task.project_id && task.addressee.startsWith('worker-')) {
    await triggerProjectManager(task);
  }
}

async function triggerProjectManager(completedTask: Task) {
  const managerAddressee = `project-mgr-${completedTask.project_id}`;

  // Idempotenz: Nicht triggern wenn schon aktiv
  if (await db.hasRunningOrPendingTask(managerAddressee)) {
    logger.debug(`Manager ${managerAddressee} already queued, skipping`);
    return;
  }

  // Projekt-Infos holen
  const project = await db.getProject(completedTask.project_id);
  if (!project || project.status === 'completed' || project.status === 'paused') {
    logger.debug(`Project ${completedTask.project_id} not active, skipping trigger`);
    return;
  }

  // Green-Task mit Kontext erstellen
  const prompt = buildManagerPrompt(completedTask);

  await db.createTask({
    addressee: managerAddressee,
    project_id: completedTask.project_id,
    prompt: prompt,
    repo_url: project.repo_url,
    branch: project.integration_branch || project.default_branch,
    triggered_by_task_id: completedTask.id,
    created_by: 'spawning-engine'
  });

  logger.info(`Triggered manager for project: ${completedTask.project_id}`);
}
```

### 2. Prompt-Builder für Green

```typescript
function buildManagerPrompt(completedTask: Task): string {
  const result = completedTask.result || {};

  return `
MANAGER_WAKEUP: Ein Worker-Task wurde abgeschlossen.

## Abgeschlossener Task

- **Task-ID:** ${completedTask.id}
- **Task-Typ:** ${completedTask.task_type || 'UNKNOWN'}
- **Status:** ${result.success ? 'ERFOLG' : 'FEHLGESCHLAGEN'}
- **Branch:** ${completedTask.branch || 'N/A'}
- **Dauer:** ${result.duration_ms ? `${result.duration_ms}ms` : 'N/A'}
- **Kosten:** ${result.cost_usd ? `$${result.cost_usd}` : 'N/A'}

## Task-Ergebnis

${result.summary || 'Keine Zusammenfassung verfügbar.'}

${result.pr_url ? `**Pull Request:** ${result.pr_url}` : ''}
${result.conflicts ? '**Hinweis:** Merge hatte Konflikte, die gelöst wurden.' : ''}

## Deine Aufgabe

1. Lies den aktuellen Plan aus \`.ai/plan.md\`
2. Analysiere das Ergebnis des abgeschlossenen Tasks
3. Entscheide über nächste Aktion:
   - CODE-Task erfolgreich → MERGE-Task erstellen
   - MERGE-Task erfolgreich → Nächsten CODE-Task erstellen
   - REVIEW mit APPROVE → MERGE-Task erstellen
   - REVIEW mit REQUEST_CHANGES → FIX-Task erstellen
   - Alle Schritte fertig → PR-Task erstellen
4. Aktualisiere den Plan entsprechend
5. Erstelle den nächsten Task

WICHTIG: Du führst selbst KEINE Git-Operationen aus. Alles läuft über Red-Tasks.
`.trim();
}
```

### 3. Watchdog für Fallback-Trigger

```typescript
// engine/watchdog.ts

const WATCHDOG_INTERVAL = 5 * 60 * 1000;  // 5 Minuten
const STALE_THRESHOLD = 10 * 60 * 1000;   // 10 Minuten ohne Aktivität

export function startWatchdog(db: TaskDatabase) {
  setInterval(async () => {
    try {
      await checkStaleProjects(db);
    } catch (error) {
      logger.error('Watchdog error:', error);
    }
  }, WATCHDOG_INTERVAL);

  logger.info('Watchdog started');
}

async function checkStaleProjects(db: TaskDatabase) {
  const staleProjects = await db.getStaleProjects(STALE_THRESHOLD);

  for (const project of staleProjects) {
    const managerAddressee = `project-mgr-${project.id}`;

    if (await db.hasRunningOrPendingTask(managerAddressee)) continue;
    if (await db.hasRunningWorkerTasksForProject(project.id)) continue;

    await db.createTask({
      addressee: managerAddressee,
      project_id: project.id,
      prompt: buildWatchdogPrompt(project),
      repo_url: project.repo_url,
      branch: project.integration_branch || project.default_branch,
      created_by: 'watchdog'
    });

    logger.info(`Watchdog triggered manager for stale project: ${project.id}`);
  }
}
```

---

## Green Agent Architektur

### Container-Struktur

```
green-agent/
├── Dockerfile
├── entrypoint.sh
├── k8s/
│   └── job.yaml
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # Haupteinstiegspunkt
    ├── config.ts             # Umgebungsvariablen
    ├── plan/
    │   ├── loader.ts         # .ai/plan.md lesen
    │   ├── writer.ts         # .ai/plan.md schreiben
    │   └── types.ts          # Plan-Datenstrukturen
    ├── tasks/
    │   ├── creator.ts        # Red-Tasks in DB erstellen
    │   ├── prompts.ts        # Prompt-Templates für Task-Typen
    │   └── analyzer.ts       # Task-Ergebnisse analysieren
    ├── decisions/
    │   └── engine.ts         # Entscheidungslogik (mit Claude)
    └── db/
        └── supabase.ts       # Datenbank-Client
```

### Umgebungsvariablen

```bash
# Pflicht
CLAUDE_CODE_OAUTH_TOKEN   # Claude Auth
GITHUB_TOKEN              # Git/GitHub Zugang
SUPABASE_URL              # Datenbank
SUPABASE_KEY              # Datenbank Auth

# Vom Spawner gesetzt
PROJECT_ID                # Projekt-Identifikator
REPO_URL                  # Repository URL
TASK_PROMPT               # Trigger-Prompt mit Kontext
TRIGGERED_BY_TASK_ID      # ID des abgeschlossenen Tasks (optional)
INTEGRATION_BRANCH        # z.B. feature/new-snake-game

# Optional
BRANCH                    # Default: main
GIT_USER_EMAIL            # Committer
GIT_USER_NAME             # Committer
```

### Hauptlogik

```typescript
// src/index.ts

async function main() {
  const config = loadConfig();
  const db = createDbClient(config);

  logger.info(`Green Manager started for project: ${config.projectId}`);

  // 1. Trigger-Task analysieren
  let triggerContext: TriggerContext | null = null;
  if (config.triggeredByTaskId) {
    const completedTask = await db.getTask(config.triggeredByTaskId);
    triggerContext = analyzeCompletedTask(completedTask);
  }

  // 2. Plan aus Prompt oder DB-Kontext laden
  // (Green clont NICHT selbst - Plan kommt aus Task-Prompt oder DB)
  const plan = await loadPlanFromContext(config, triggerContext);

  // 3. Nächste Aktion bestimmen
  const decision = await determineNextAction(plan, triggerContext);

  // 4. Aktion ausführen (= Task erstellen)
  switch (decision.action) {
    case 'CREATE_CODE_TASK':
      await createTask(db, config, 'CODE', decision.spec);
      break;

    case 'CREATE_MERGE_TASK':
      await createTask(db, config, 'MERGE', decision.spec);
      break;

    case 'CREATE_REVIEW_TASK':
      await createTask(db, config, 'REVIEW', decision.spec);
      break;

    case 'CREATE_FIX_TASK':
      await createTask(db, config, 'FIX', decision.spec);
      break;

    case 'CREATE_PR_TASK':
      await createTask(db, config, 'PR', decision.spec);
      break;

    case 'MARK_AWAITING_REVIEW':
      await db.updateProject(config.projectId, {
        status: 'awaiting_review',
        pr_url: triggerContext?.result?.pr_url,
        pr_number: triggerContext?.result?.pr_number
      });
      break;

    case 'PAUSE_FOR_REVIEW':
      await db.updateProject(config.projectId, { status: 'paused' });
      break;

    case 'DISCARD_AND_RETRY':
      // Branch verwerfen, neuen Code-Task mit angepasstem Prompt
      await createTask(db, config, 'CODE', decision.retrySpec);
      break;
  }

  // 5. Plan aktualisieren und committen
  await updatePlan(plan, decision);
  await git.commitAndPush('.ai/plan.md', `Plan update: ${decision.action}`);

  logger.info(`Green Manager completed: ${decision.action}`);
}
```

### Task-Creator

```typescript
// src/tasks/creator.ts

interface TaskSpec {
  stepId?: string;
  description: string;
  prompt: string;
  sourceBranch?: string;   // Für Merge: welcher Branch
  targetBranch?: string;   // Für Merge: wohin
}

async function createTask(
  db: TaskDatabase,
  config: Config,
  taskType: TaskType,
  spec: TaskSpec
): Promise<string> {
  const taskId = uuid();
  const addressee = `worker-${taskType.toLowerCase()}-${taskId.slice(0, 8)}`;

  // Branch-Name generieren (für Code-Tasks)
  let branch = spec.targetBranch;
  if (taskType === 'CODE' || taskType === 'FIX') {
    branch = `feature/step-${spec.stepId || 'x'}-${Date.now()}`;
  }

  await db.createTask({
    id: taskId,
    addressee: addressee,
    project_id: config.projectId,
    task_type: taskType,
    prompt: spec.prompt,
    repo_url: config.repoUrl,
    branch: branch,
    created_by: `project-mgr-${config.projectId}`
  });

  logger.info(`Created ${taskType} task: ${taskId}`);
  return taskId;
}
```

### Prompt-Templates

```typescript
// src/tasks/prompts.ts

export function buildCodeTaskPrompt(spec: CodeTaskSpec): string {
  return `
## Aufgabe: ${spec.description} (Code-Task)

### Basis
Erstelle deinen Arbeits-Branch von \`${spec.integrationBranch}\`:
\`feature/step-${spec.stepId}-{timestamp}\`

### Implementierung
${spec.instructions}

### Abschluss
1. Stelle sicher, dass \`npm run build\` erfolgreich ist
2. Committe alle Änderungen auf deinem Branch
3. Pushe deinen Branch

WICHTIG:
- Merge NICHT nach ${spec.integrationBranch}
- Erstelle KEINEN Pull Request
- Dein Branch bleibt separat für Review
`.trim();
}

export function buildMergeTaskPrompt(spec: MergeTaskSpec): string {
  return `
## Aufgabe: Branch Merge (Merge-Task)

### Auftrag
Merge den Branch \`${spec.sourceBranch}\` in \`${spec.targetBranch}\`.

### Schritte
1. Checke \`${spec.targetBranch}\` aus
2. Merge \`${spec.sourceBranch}\` hinein
3. Bei Konflikten: Löse sie sinnvoll auf
4. Stelle sicher, dass \`npm run build\` nach dem Merge erfolgreich ist
5. Pushe \`${spec.targetBranch}\`

### Ergebnis melden
- Ob der Merge erfolgreich war
- Ob es Konflikte gab und wie sie gelöst wurden
- Build-Status nach Merge

WICHTIG: Dies ist ein reiner Merge-Task. Keine neuen Features implementieren.
`.trim();
}

export function buildReviewTaskPrompt(spec: ReviewTaskSpec): string {
  return `
## Aufgabe: Code-Review (Review-Task)

### Zu prüfender Branch
\`${spec.branchToReview}\`

### Prüfkriterien
1. Funktionalität: Erfüllt der Code die Anforderungen?
2. Code-Qualität: Ist der Code sauber und wartbar?
3. Security: Gibt es Sicherheitsprobleme?
4. Performance: Gibt es offensichtliche Performance-Issues?
5. Build: Läuft \`npm run build\` erfolgreich?

### Ergebnis
Melde im Result:
- **APPROVE**: Code ist gut, kann gemerged werden
- **REQUEST_CHANGES**: Probleme gefunden (beschreibe sie detailliert)
- **REJECT**: Fundamentale Probleme, Branch sollte verworfen werden
`.trim();
}

export function buildPRTaskPrompt(spec: PRTaskSpec): string {
  return `
## Aufgabe: Pull Request erstellen (PR-Task)

### Auftrag
Erstelle einen Pull Request von \`${spec.sourceBranch}\` nach \`${spec.targetBranch}\`.

### Schritte
1. Checke \`${spec.sourceBranch}\` aus
2. Lies \`.ai/plan.md\` für die Zusammenfassung
3. Erstelle PR mit \`gh pr create\`:
   - Base: ${spec.targetBranch}
   - Head: ${spec.sourceBranch}
   - Title: "${spec.title}"
   - Body: Generiere aus Plan (Features, Schritte, Kosten)

### Ergebnis melden
- PR-URL
- PR-Nummer

WICHTIG: Nur PR erstellen, nichts mergen. User reviewed und approved.
`.trim();
}
```

---

## Flow-Diagramme

### Epic-Lifecycle (Korrigiert)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. EPIC CREATION (Blue UI - später)                             │
└─────────────────────────────────────────────────────────────────┘
User erstellt Epic für Projekt "snake-game"
       ↓
Blue schreibt Task:
  addressee: project-mgr-snake-game
  project_id: snake-game
  prompt: "Erstelle Snake Clone..."
       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. INITIAL PLANNING (Green)                                     │
└─────────────────────────────────────────────────────────────────┘
Green startet, analysiert Epic
       ↓
Erstellt Plan (im Prompt für ersten Task)
       ↓
Erstellt CODE-Task:
  addressee: worker-code-a1b2c3d4
  task_type: CODE
  prompt: "Schritt 1: Projekt initialisieren..."
       ↓
Green stirbt
       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. CODE EXECUTION (Red)                                         │
└─────────────────────────────────────────────────────────────────┘
Red führt Task aus
       ↓
Erstellt feature/step-1-init-1234567
Pusht Branch (MERGED NICHT!)
       ↓
Meldet: { success: true, branch: "feature/step-1-init-1234567" }
       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. MANAGER TRIGGER (Engine)                                     │
└─────────────────────────────────────────────────────────────────┘
Engine erkennt Completion
       ↓
Erstellt Green-Task mit Result-Kontext
       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. MERGE DECISION (Green)                                       │
└─────────────────────────────────────────────────────────────────┘
Green analysiert: CODE-Task erfolgreich
       ↓
Erstellt MERGE-Task:
  addressee: worker-merge-e5f6g7h8
  task_type: MERGE
  prompt: "Merge feature/step-1-init-1234567 → feature/snake-game"
       ↓
Green stirbt
       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. MERGE EXECUTION (Red)                                        │
└─────────────────────────────────────────────────────────────────┘
Red führt Merge aus
       ↓
Löst ggf. Konflikte
Pusht feature/snake-game
       ↓
Meldet: { success: true, conflicts: false }
       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. NEXT STEP (Green)                                            │
└─────────────────────────────────────────────────────────────────┘
Green analysiert: MERGE erfolgreich
       ↓
Schritt 1 = DONE
       ↓
Erstellt CODE-Task für Schritt 2
       ↓
Green stirbt
       ↓
... Wiederholt für alle Schritte ...
       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. EPIC COMPLETE - PR CREATION (Green + Red)                    │
└─────────────────────────────────────────────────────────────────┘
Green erkennt: Alle Schritte DONE
       ↓
Erstellt PR-Task:
  addressee: worker-pr-i9j0k1l2
  task_type: PR
  prompt: "Erstelle PR: feature/snake-game → main"
       ↓
Red erstellt PR via gh pr create
       ↓
Meldet: { success: true, pr_url: "...", pr_number: 42 }
       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. AWAITING REVIEW (Green)                                      │
└─────────────────────────────────────────────────────────────────┘
Green sieht: PR erstellt
       ↓
Projekt status = 'awaiting_review'
Speichert pr_url, pr_number
       ↓
Green stirbt
       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 10. CI/CD + USER REVIEW                                         │
└─────────────────────────────────────────────────────────────────┘
GitHub Actions läuft automatisch
       ↓
Preview-Deployment live
       ↓
User testet, reviewed
       ↓
Bei Änderungswünschen: Blue/User triggert Green erneut
```

### Branch-Lifecycle

```
main
  │
  ├── feature/snake-game (Integration-Branch)
  │         │
  │         ├── feature/step-1-init-xxx ──────────────┐
  │         │                                         │ MERGE-Task
  │         │←────────────────────────────────────────┘
  │         │
  │         ├── feature/step-2-game-xxx ──────────────┐
  │         │                                         │ MERGE-Task
  │         │←────────────────────────────────────────┘
  │         │
  │         ├── feature/step-3-auth-xxx ──────────────┐
  │         │                                         │ MERGE-Task
  │         │←────────────────────────────────────────┘
  │         │
  │         └── ... weitere Steps ...
  │
  │←─────── PR-Task erstellt PR
  │         User approved + merged
  │
main (mit Feature)
```

---

## Fehlerbehandlung

### CODE-Task schlägt fehl

```
Red Task failed
       ↓
Engine triggert Green mit:
  result.success = false
  result.summary = "Fehler: npm install failed..."
       ↓
Green analysiert Fehler:
  - Transient? → Retry mit gleichem Prompt
  - Permanent? → Alternativer Ansatz
  - Unklar? → Projekt pausieren für Review
```

### MERGE-Task hat Konflikte

```
Merge-Red meldet:
  result.success = true
  result.conflicts = true
  result.resolved_files = ["app/page.tsx"]
       ↓
Green sieht Konflikte wurden gelöst
       ↓
Optional: VALIDATE-Task erstellen
       ↓
Oder: Direkt weiter
```

### REVIEW ergibt REQUEST_CHANGES

```
Review-Red meldet:
  decision = "REQUEST_CHANGES"
  issues = ["Missing error handling", "No tests"]
       ↓
Green erstellt FIX-Task mit Issues im Prompt
       ↓
Nach FIX: Erneuter MERGE-Task
```

### REVIEW ergibt REJECT

```
Review-Red meldet:
  decision = "REJECT"
  reason = "Fundamentally wrong approach"
       ↓
Green verwirft Branch (kein Merge)
       ↓
Green erstellt neuen CODE-Task mit:
  - Angepasstem Prompt
  - Hinweis auf vorherigen Fehler
```

---

## Implementierungs-Reihenfolge

### Phase 1: Engine-Erweiterung

1. [ ] DB-Schema erweitern (`project_id`, `task_type`, `triggered_by_task_id`)
2. [ ] `projects` Tabelle erstellen
3. [ ] Trigger-Logik in `reaper.ts` implementieren
4. [ ] Prompt-Builder für Manager-Wakeup
5. [ ] Watchdog implementieren

### Phase 2: Green Agent Basis

1. [ ] Container-Setup (Dockerfile, entrypoint.sh)
2. [ ] Task-Creator für alle Task-Typen
3. [ ] Prompt-Templates
4. [ ] Basis-Entscheidungslogik (regelbasiert)

### Phase 3: Intelligente Planung

1. [ ] Claude-Integration für Planungsentscheidungen
2. [ ] Fehleranalyse und Retry-Strategien
3. [ ] Review-Entscheidungen
4. [ ] Plan-Evolution

### Phase 4: Blue UI (Später)

1. [ ] Projekt-Dashboard
2. [ ] Epic-Erstellung
3. [ ] PR-Review-Interface
4. [ ] Änderungswünsche eingeben

---

## Geklärte Design-Entscheidungen

### Plan-Persistenz

**Entscheidung:** Plan liegt ausschließlich in `.ai/plan.md` im Git-Repository.

- Green darf `.ai/plan.md` direkt committen und pushen
- Das `.ai/` Verzeichnis enthält allen Projekt-Kontext
- Kein Plan in der Datenbank - Git ist Single Source of Truth

### Branch-Cleanup

**Entscheidung:** Step-Branches werden nach erfolgreichem Merge gelöscht.

Der MERGE-Task enthält am Ende:
```bash
git branch -d feature/step-X-timestamp  # Lokal
git push origin --delete feature/step-X-timestamp  # Remote
```

### Cost-Limits

**Entscheidung:** Keine Cost-Limits aktuell.

Wir arbeiten mit Claude Subscription (Flatrate). Bei Umstellung auf API-basierte Abrechnung wird dies relevant.

### Parallelisierung

**Entscheidung:** Später, wird Green's Intelligenz überlassen.

Beispiel für spätere Parallelisierung:
```
Contract definieren (API-Spec)
       ↓
   ┌───┴───┐
   ↓       ↓
UI-Impl  Backend-Impl  (parallel, weil Contract steht)
   │       │
   └───┬───┘
       ↓
Integration
```

Aktuell: Sequentielle Abarbeitung.
