# Green Layer - Implementierungsplan

## Übersicht

Der Green Layer (Project Manager) wird als ephemerer K8s Job implementiert, der event-driven von der Spawning Engine getriggert wird. Green plant iterativ und erstellt Tasks für Red Worker.

---

## Phase 1: Datenbank-Schema Erweiterungen

### 1.1 Tasks-Tabelle erweitern

```sql
-- Neue Spalten für Tasks
ALTER TABLE tasks ADD COLUMN project_id VARCHAR(255);
ALTER TABLE tasks ADD COLUMN task_type VARCHAR(50);  -- CODE, MERGE, REVIEW, FIX, PR, VALIDATE
ALTER TABLE tasks ADD COLUMN triggered_by_task_id UUID REFERENCES tasks(id);

-- Indices
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
```

### 1.2 Projects-Tabelle erstellen

```sql
CREATE TABLE projects (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    repo_url TEXT NOT NULL,
    default_branch VARCHAR(255) DEFAULT 'main',
    integration_branch VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    current_epic TEXT,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10,4) DEFAULT 0,
    pr_url TEXT,
    pr_number INTEGER
);

CREATE INDEX idx_projects_active ON projects(status, last_activity) WHERE status = 'active';
```

---

## Phase 2: Spawning Engine Erweiterungen

### 2.1 Neue Dateien

```
spawning-engine/src/
├── db/
│   ├── supabase.ts          # Erweitert: createTask(), getProject(), updateProject()
│   └── projects.ts          # NEU: Project-spezifische Operationen
└── engine/
    ├── reaper.ts            # Erweitert: triggerProjectManager() nach Completion
    └── prompts.ts           # NEU: buildManagerPrompt()
```

### 2.2 TaskDatabase erweitern

- `createTask(task)` - Task erstellen (für Manager-Trigger)
- `hasRunningOrPendingTask(addressee)` - Prüfen ob Addressee schon aktiv
- `getProject(projectId)` - Projekt laden
- `updateProject(projectId, updates)` - Projekt aktualisieren
- `getTask(taskId)` - Einzelnen Task laden (für Trigger-Kontext)

### 2.3 Reaper-Logik erweitern

Nach `completeTask()` oder `failTask()`:
```typescript
if (task.project_id && task.addressee.startsWith('worker-')) {
  await triggerProjectManager(task);
}
```

---

## Phase 3: Green Agent Container

### 3.1 Verzeichnisstruktur

```
green-agent/
├── Dockerfile
├── entrypoint.sh
├── package.json
├── tsconfig.json
├── k8s/
│   └── job.yaml              # Template für K8s Job
└── src/
    ├── index.ts              # Haupteinstiegspunkt
    ├── config.ts             # Umgebungsvariablen
    ├── logger.ts             # Logging
    ├── db/
    │   └── supabase.ts       # Datenbank-Client
    ├── git/
    │   └── operations.ts     # Git-Operationen (nur für .ai/plan.md)
    ├── plan/
    │   ├── loader.ts         # Plan aus Repo lesen
    │   ├── parser.ts         # Plan-Markdown parsen
    │   ├── writer.ts         # Plan schreiben + committen
    │   └── types.ts          # Plan-Datenstrukturen
    ├── tasks/
    │   ├── creator.ts        # Red-Tasks in DB erstellen
    │   └── prompts.ts        # Prompt-Templates pro Task-Typ
    └── decisions/
        └── engine.ts         # Entscheidungslogik
```

### 3.2 Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `CLAUDE_CODE_OAUTH_TOKEN` | Ja | Claude Auth |
| `GITHUB_TOKEN` | Ja | Git/GitHub Zugang |
| `SUPABASE_URL` | Ja | Datenbank |
| `SUPABASE_KEY` | Ja | Datenbank Auth |
| `PROJECT_ID` | Ja | Projekt-Identifikator |
| `REPO_URL` | Ja | Repository URL |
| `TASK_PROMPT` | Ja | Trigger-Prompt mit Kontext |
| `TRIGGERED_BY_TASK_ID` | Nein | ID des abgeschlossenen Tasks |
| `INTEGRATION_BRANCH` | Nein | z.B. feature/new-snake-game |
| `BRANCH` | Nein | Default: main |

### 3.3 Hauptlogik (src/index.ts)

```typescript
async function main() {
  // 1. Config laden und validieren
  const config = loadConfig();
  const db = new TaskDatabase(config);

  // 2. Repo clonen
  await cloneRepo(config.repoUrl, config.branch);

  // 3. Trigger-Kontext laden (wenn vorhanden)
  let triggerContext: TriggerContext | null = null;
  if (config.triggeredByTaskId) {
    const completedTask = await db.getTask(config.triggeredByTaskId);
    triggerContext = analyzeCompletedTask(completedTask);
  }

  // 4. Plan laden oder initialisieren
  const plan = await loadOrInitializePlan(config, triggerContext);

  // 5. Nächste Aktion bestimmen (mit Claude)
  const decision = await determineNextAction(plan, triggerContext, config);

  // 6. Aktion ausführen
  await executeDecision(db, config, decision);

  // 7. Plan aktualisieren und committen
  await updateAndCommitPlan(plan, decision);

  log.info(`Green Manager completed: ${decision.action}`);
}
```

---

## Phase 4: Entscheidungslogik

### 4.1 Decision-Typen

```typescript
type DecisionAction =
  | 'CREATE_CODE_TASK'      // Nächsten Code-Schritt starten
  | 'CREATE_MERGE_TASK'     // Branch mergen
  | 'CREATE_REVIEW_TASK'    // Code-Review
  | 'CREATE_FIX_TASK'       // Fixes nach Review
  | 'CREATE_PR_TASK'        // PR erstellen
  | 'CREATE_VALIDATE_TASK'  // Build/Test validieren
  | 'MARK_AWAITING_REVIEW'  // Auf User-Review warten
  | 'PAUSE_FOR_REVIEW'      // Projekt pausieren
  | 'DISCARD_AND_RETRY'     // Branch verwerfen, neu versuchen
  | 'COMPLETE_PROJECT';     // Projekt abschließen
```

### 4.2 Entscheidungsmatrix (Regelbasiert + Claude)

| Completed Task | Result | Nächste Aktion |
|----------------|--------|----------------|
| CODE | success | CREATE_MERGE_TASK |
| CODE | failed | DISCARD_AND_RETRY oder PAUSE |
| MERGE | success, keine weiteren Steps | CREATE_PR_TASK |
| MERGE | success, weitere Steps | CREATE_CODE_TASK |
| MERGE | failed (Konflikte) | CREATE_FIX_TASK |
| REVIEW | APPROVE | CREATE_MERGE_TASK |
| REVIEW | REQUEST_CHANGES | CREATE_FIX_TASK |
| REVIEW | REJECT | DISCARD_AND_RETRY |
| FIX | success | CREATE_MERGE_TASK oder CREATE_REVIEW_TASK |
| PR | success | MARK_AWAITING_REVIEW |
| VALIDATE | success | weiter im Flow |
| VALIDATE | failed | CREATE_FIX_TASK |

### 4.3 Claude-Integration für komplexe Entscheidungen

Green nutzt Claude CLI für:
- Initiale Plan-Erstellung bei neuem Epic
- Analyse von Fehlern und Entscheidung über Retry/Abort
- Generierung von Task-Prompts basierend auf Kontext

---

## Phase 5: Plan-Management

### 5.1 Plan-Struktur (.ai/plan.md)

```markdown
# {Epic-Name} - Projektplan

## Epic
{Epic-Beschreibung}

## Integration Branch
{feature/branch-name}

## Schritte

### Schritt 1: {Name}
- Status: DONE | IN_PROGRESS | PENDING | MERGING | FAILED
- Task-Type: CODE | MERGE | REVIEW | FIX | PR | VALIDATE
- Branch: feature/step-1-{name}-{timestamp}
- Completed: {timestamp}
- Cost: ${amount}

### Schritt 2: {Name}
- Status: IN_PROGRESS
- ...

## Statistiken
- Total Cost: ${amount}
- Total Tasks: {count}
- Completed: {count}
- Failed: {count}
```

### 5.2 Plan-Operationen

- `loadPlan()` - Plan aus `.ai/plan.md` lesen und parsen
- `initializePlan(epicPrompt)` - Neuen Plan mit Claude erstellen
- `updatePlan(plan, decision)` - Plan nach Aktion aktualisieren
- `commitPlan(message)` - Plan committen und pushen

---

## Phase 6: Spawning Engine Job-Erstellung

### 6.1 Green-Job spawnen

Die Spawning Engine erstellt Green-Jobs wie Red-Jobs, aber mit:
- Anderem Image: `tobiaswaggoner/green-agent:latest`
- Zusätzlichen Env-Vars: `PROJECT_ID`, `TRIGGERED_BY_TASK_ID`, `INTEGRATION_BRANCH`
- Secrets: Zusätzlich `SUPABASE_URL`, `SUPABASE_KEY`

### 6.2 Job-Unterscheidung

```typescript
function createJob(task: Task) {
  const isManager = task.addressee.startsWith('project-mgr-');

  return {
    image: isManager
      ? config.greenAgentImage
      : config.redAgentImage,
    envFrom: isManager
      ? ['coding-swarm-secrets', 'spawning-engine-secrets']  // Green braucht DB-Zugang
      : ['coding-swarm-secrets'],                             // Red nur Git/Claude
    env: {
      ...commonEnv,
      ...(isManager && {
        PROJECT_ID: task.project_id,
        TRIGGERED_BY_TASK_ID: task.triggered_by_task_id,
        INTEGRATION_BRANCH: project.integration_branch,
      }),
    },
  };
}
```

---

## Implementierungs-Reihenfolge

### Schritt 1: DB-Schema (SQL in Supabase Dashboard)
- [ ] Tasks-Tabelle erweitern
- [ ] Projects-Tabelle erstellen
- [ ] Indices erstellen

### Schritt 2: Spawning Engine erweitern
- [ ] `TaskDatabase.createTask()` implementieren
- [ ] `TaskDatabase.getProject()` implementieren
- [ ] `TaskDatabase.updateProject()` implementieren
- [ ] `TaskDatabase.hasRunningOrPendingTask()` implementieren
- [ ] `triggerProjectManager()` in reaper.ts
- [ ] `buildManagerPrompt()` implementieren
- [ ] Job-Erstellung für Green-Agents anpassen

### Schritt 3: Green Agent Basis
- [ ] Verzeichnisstruktur erstellen
- [ ] Dockerfile erstellen
- [ ] entrypoint.sh erstellen
- [ ] package.json mit Dependencies
- [ ] tsconfig.json
- [ ] Config-Loading
- [ ] Logger

### Schritt 4: Green Agent Core
- [ ] Git-Operationen (clone, commit, push)
- [ ] Plan-Loader/Parser/Writer
- [ ] Task-Creator mit Prompt-Templates
- [ ] Entscheidungslogik (regelbasiert)

### Schritt 5: Green Agent Claude-Integration
- [ ] Claude CLI Aufruf für Plan-Generierung
- [ ] Claude CLI Aufruf für Entscheidungen
- [ ] Fehleranalyse mit Claude

### Schritt 6: K8s Deployment
- [ ] Green Agent Image bauen und pushen
- [ ] Secrets für Green Agent konfigurieren
- [ ] Test mit manuellem Task

### Schritt 7: Integration Test
- [ ] Epic-Task erstellen (wie im Szenario)
- [ ] Vollständigen Workflow durchlaufen
- [ ] Logs und Ergebnisse validieren

---

## Test-Szenario

Nach Implementierung sollte folgender Flow funktionieren:

1. User erstellt Task:
   ```sql
   INSERT INTO tasks (addressee, project_id, prompt, repo_url, branch)
   VALUES (
     'project-mgr-snake-game',
     'snake-game',
     'Erstelle einen webbasierten Snake Clone...',
     'https://github.com/user/snake-game',
     'main'
   );
   ```

2. Engine spawnt Green → Green erstellt Plan → Green erstellt CODE-Task → Green stirbt

3. Engine spawnt Red (CODE) → Red implementiert → Red pusht Branch → Red stirbt

4. Engine erkennt Completion → Engine triggert Green

5. Green analysiert → Green erstellt MERGE-Task → Green stirbt

6. ... Workflow wie in scenario.md beschrieben ...

---

## Offene Fragen

1. **Watchdog:** Soll der Watchdog in Phase 1 implementiert werden oder später?
   → Empfehlung: Später, da primärer Trigger ausreicht

2. **Parallelisierung:** Soll Green mehrere CODE-Tasks parallel erstellen können?
   → Empfehlung: Nein, erstmal sequentiell. Später Green's Intelligenz überlassen.

3. **Cost-Tracking:** Wie detailliert sollen Kosten getrackt werden?
   → Empfehlung: Aggregiert pro Projekt, Details in task_logs
