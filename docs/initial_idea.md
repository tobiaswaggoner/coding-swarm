# Autonomous Coding Swarm - Design-Dokument

![Initial Idea](initial_idea.png)

## Vision

Maximale Parallelisierung der Entwicklungsarbeit durch autonome AI-Agenten, die 24/7 im Hintergrund arbeiten.

---

## RGB-Agenten Glossar

| Agent | Rolle | Beschreibung |
|-------|-------|--------------|
| 🔴 **Red** | Worker | Führt EINEN Task aus, pusht Branch, meldet Ergebnis. **MERGED NIE!** |
| 🟢 **Green** | Project Manager | Plant iterativ, erstellt Tasks für Red, führt selbst **KEINE Git-Ops aus** |
| 🔵 **Blue** | Executive | UI für Epics, Monitoring, manuelle Eingriffe, PR-Review |
| ⚙️ **Engine** | Dispatcher | Einziger persistenter Prozess, spawnt K8s Jobs, triggert Green bei Completion |

```
🔵 Blue ──Epic──▶ 🟢 Green ──CODE-Task──▶ 🔴 Red
                      │                      │
                      │◀──Engine-Trigger─────┘
                      │
                      ├── Analysiert Result
                      │
                      ├──MERGE-Task──▶ 🔴 Red (separater Merge)
                      │                   │
                      │◀──Engine-Trigger──┘
                      │
                      └── Nächster Schritt oder PR-Task
```

---

## Architektur

### Spawning Engine (Singleton)
- Pollt `tasks` Tabelle auf `status = 'pending'`
- Pro Adressat: max 1 laufender Job (Sequenzierung)
- Spawnt K8s Job, extrahiert Result aus JSONL-Logs

### Adressaten-Prinzip
| Adressat | Verhalten |
|----------|-----------|
| `project-mgr-{project}` | Sequenziell |
| `worker-{uuid}` | Parallel |

---

## Datenmodell (Supabase/PostgreSQL)

```sql
CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    addressee       VARCHAR(255) NOT NULL,
    status          VARCHAR(50) DEFAULT 'pending',  -- pending, running, completed
    prompt          TEXT NOT NULL,
    repo_url        TEXT,
    branch          VARCHAR(255),
    created_by      VARCHAR(255),
    created_at      TIMESTAMP DEFAULT NOW(),
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    result          JSONB,      -- {success, summary, pr_url, cost_usd, duration_ms}
    worker_pod      VARCHAR(255)
);

CREATE TABLE task_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE,
    jsonl_content   TEXT NOT NULL,  -- Volles JSONL für Diagnose
    log_size_bytes  INTEGER,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tasks_pending ON tasks(addressee, status) WHERE status = 'pending';
CREATE INDEX idx_tasks_running ON tasks(addressee) WHERE status = 'running';
```

---

## Red Agent - System-Regeln

Diese Regeln gelten für alle Red Agent Tasks:

1. **GH CLI verwenden** - Immer `gh` für Git-Operationen (Push, ggf. PR)
2. **Einzigartige Branches** - Format: `feature/step-<id>-$(date +%s)`
3. **Unterverzeichnisse** - Neue Apps nie im Root, immer in Subfoldern
4. **Non-Interactive** - Alle CLI-Tools mit `--yes` oder Silent-Flags
5. **Validierung** - Lint + Build müssen vor Commit erfolgreich sein
6. **NIEMALS mergen** - Red pusht nur seinen Branch, Merge ist separater Task
7. **Task-Typen beachten** - CODE, MERGE, REVIEW, FIX, PR, VALIDATE haben unterschiedliche Aufgaben

---

## Implementierungs-Status

### ✅ Erledigt: Red Agent (Spike-01)
- Docker-Container funktioniert lokal und in K8s
- Base-Image: Node 25, Python 3.13, .NET 9, Claude CLI, gh CLI
- OAuth-Token Authentication via K8s Secrets
- JSONL Streaming Output (`--output-format stream-json --verbose`)
- Erfolgreicher Test: NextJS App erstellt, Branch gepusht, PR erstellt

### ✅ Erledigt: Spawning Engine

**Features implementiert:**
- ✅ Poll-Loop: Pending Tasks abrufen
- ✅ Adressat-Check: Läuft schon ein Job? → Sequenzierung
- ✅ K8s Job spawnen mit Task-ID
- ✅ Job-Completion/-Failure Detection
- ✅ JSONL-Logs parsen, Result + Logs speichern
- ✅ Timeout-Handling (Job löschen, Task als failed markieren)
- ✅ Graceful Shutdown (SIGTERM)
- ✅ Backpressure via `MAX_PARALLEL_JOBS`
- ✅ Singleton-Lock (File-basiert)

**Architektur:**
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Supabase   │◀───▶│   Spawner    │────▶│   K8s Job    │
│   (Tasks)    │     │ (Singleton)  │     │ (Red Agent)  │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Verzeichnis:** `spawning-engine/`

### 🔄 Nächster Schritt: Green Agent (Project Manager)

**Ziel:** Ephemerer K8s Job, der event-driven getriggert wird und Red-Tasks orchestriert

**Design-Prinzipien:**
- **Event-driven, kein Polling** - Green wird von Engine bei Task-Completion getriggert
- **Ephemer** - Green plant, erstellt Task, stirbt
- **Keine Git-Ops** - Auch Merge und PR-Erstellung laufen über Red-Tasks
- **Task-Typen:** CODE → MERGE → (nächster CODE) → ... → PR

**Workflow pro Schritt:**
```
Green erstellt CODE-Task → Red implementiert → Engine triggert Green
                                                      ↓
Green erstellt MERGE-Task → Red merged → Engine triggert Green
                                                      ↓
                                          Green erstellt nächsten CODE-Task
```

**Detaillierte Dokumentation:** Siehe `docs/green-layer-design.md` und `docs/scenario.md`

### Später: Blue UI (Executive Dashboard)

---

## Technische Entscheidungen

| Entscheidung | Begründung |
|--------------|------------|
| PostgreSQL/Supabase | Persistenz, Debugging, Multi-Cluster |
| Claude Code CLI | RAG, File-Search, Syntax-Checks out-of-the-box |
| OAuth statt API-Key | Subscription-Billing, Kostenkontrolle |
| Ephemere Agents | Keine Zombie-Prozesse, sauberer State |
| Ein Task = Ein Branch | Isolation, keine Merge-Konflikte |
| Merge als separater Task | Review-Möglichkeit, Konflikt-Isolation, Kontrolle |
| Event-driven statt Polling | Keine Idle-Kosten, saubere Architektur |
| PR via Red-Task | Green führt keine Git-Ops aus, konsistentes Modell |
| Engine triggert Green | Zentraler Dispatcher, keine verlorenen Events |
| `.ai/` Verzeichnis | Plan + Kontext, Green darf committen |
| Step-Branches löschen | Nach erfolgreichem Merge automatisch entfernen |
