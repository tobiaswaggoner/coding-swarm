# Autonomous Coding Swarm - Design-Dokument

![Initial Idea](initial_idea.png)

## Vision

Maximale Parallelisierung der Entwicklungsarbeit durch autonome AI-Agenten, die 24/7 im Hintergrund arbeiten.

---

## RGB-Agenten Glossar

| Agent | Rolle | Beschreibung |
|-------|-------|--------------|
| 🔴 **Red** | Worker | Führt EINEN Task aus, pusht Branch, meldet Ergebnis. **MERGED NIE!** |
| 🟢 **Green** | Project Manager | Claude-gesteuert via System-Prompt + 4 Skripte. Plant, delegiert, kommuniziert. **KEINE Git-Ops** |
| 🔵 **Blue** | Executive Assistant | AI-Agent (geplant): Hauptassistent für Epic-Planung, Kommunikation mit User, Entscheidungen |
| ⚙️ **Engine** | Dispatcher | Einziger persistenter Prozess, spawnt K8s Jobs, triggert Green bei Completion |
| 🖥️ **Cockpit** | Control UI | Next.js Web-Interface: Dashboard, Projekt-Management, Task-Monitoring, Chat |

```
🔵 Blue ──Epic──▶ 🟢 Green ──WORK-Task──▶ 🔴 Red
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
- Singleton-Lock via DB-Heartbeat (30s Timeout)
- Triggert Green Agent bei Worker-Task-Completion

### Adressaten-Prinzip
| Adressat | Verhalten |
|----------|-----------|
| `project-mgr-{project}` | Sequenziell |
| `worker-{uuid}` | Parallel |

---

## Datenmodell (Supabase/PostgreSQL)

Vollständige Schema-Dokumentation: siehe `docs/database_schema.md`

**Tabellen:**
- `tasks` - Task-Queue mit Status-Tracking
- `task_logs` - JSONL-Logs für Diagnose
- `projects` - Projekt-Metadaten und Statistiken
- `engine_lock` - Singleton-Lock für Spawning Engine
- `cockpit_users` - GitHub OAuth User-Verwaltung
- `conversations` - Chat-Konversationen pro Projekt
- `messages` - Chat-Nachrichten

---

## Red Agent - System-Regeln

Diese Regeln gelten für alle Red Agent Tasks:

1. **GH CLI verwenden** - Immer `gh` für Git-Operationen (Push, ggf. PR)
2. **Einzigartige Branches** - Format: `feature/step-<id>-$(date +%s)`
3. **Unterverzeichnisse** - Neue Apps nie im Root, immer in Subfoldern
4. **Non-Interactive** - Alle CLI-Tools mit `--yes` oder Silent-Flags
5. **Validierung** - Lint + Build müssen vor Commit erfolgreich sein
6. **NIEMALS mergen** - Red pusht nur seinen Branch, Merge ist separater Task
7. **Task-Typen beachten** - CODE, MERGE, REVIEW, FIX, PR, VALIDATE, WORK haben unterschiedliche Aufgaben

---

## Green Agent - Funktionsweise

Green ist **Claude-gesteuert** via System-Prompt (`prompts/green/system.md`).

**Erlaubte Aktionen (nur 4 Bash-Skripte):**
```bash
./scripts/delegate-to-red.sh "<task>" [branch]  # Arbeit delegieren
./scripts/send-message.sh "<nachricht>"          # Chat-Nachricht senden
./scripts/update-plan.sh "<commit-msg>"          # Plan committen
./scripts/request-clarification.sh "<frage>"     # User fragen + pausieren
```

**Verboten:**
- Code lesen (Grep, Read) - verhindert Analyse-Paralyse
- Code schreiben (Edit, Write) - erzwingt Delegation
- Direkte Git-Ops - außer Plan-Updates via Skript

**Trigger-Modi:**
1. `USER_MESSAGE` - User sendet Chat-Nachricht
2. `TASK_COMPLETED` - Worker-Task abgeschlossen
3. `INITIAL` - Neues Projekt oder manueller Start

---

## Implementierungs-Status

### ✅ Erledigt: Red Agent
- Docker-Container funktioniert lokal und in K8s
- Base-Image: Node 25, Python 3.13, .NET 9, Claude CLI, gh CLI
- OAuth-Token Authentication via K8s Secrets
- JSONL Streaming Output (`--output-format stream-json --verbose`)
- Intelligentes Branch-Handling (erstellt + pusht wenn nicht vorhanden)
- GIT_ASKPASS für sichere Token-Authentifizierung

### ✅ Erledigt: Spawning Engine

**Features implementiert:**
- ✅ Poll-Loop: Pending Tasks abrufen (5s Intervall)
- ✅ Adressat-Check: Läuft schon ein Job? → Sequenzierung
- ✅ K8s Job spawnen mit Task-ID und Projekt-Kontext
- ✅ Job-Completion/-Failure Detection
- ✅ JSONL-Logs parsen, Result + Logs speichern
- ✅ Timeout-Handling (30min Default, Job löschen, Task als failed markieren)
- ✅ Graceful Shutdown (SIGTERM)
- ✅ Backpressure via `MAX_PARALLEL_JOBS` (Default: 10)
- ✅ Singleton-Lock via DB-Heartbeat (30s Timeout)
- ✅ Green Agent triggern bei Worker-Task-Completion
- ✅ Idempotenz-Check (kein doppeltes Green-Triggering)
- ✅ Projekt-Statistik-Updates (total/completed/failed tasks)

**Architektur:**
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Supabase   │◀───▶│   Spawner    │────▶│   K8s Job    │
│   (Tasks)    │     │ (Singleton)  │     │ (Red/Green)  │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       │                    ├── Reaper: Status-Tracking
       │                    └── Lock: DB-Heartbeat
       │
       └── Realtime → Cockpit
```

### ✅ Erledigt: Green Agent (Project Manager)

**Implementiert:**
- ✅ Claude-gesteuertes Design (System-Prompt statt hartcodierte Logik)
- ✅ 4 Bash-Skripte als einzige erlaubte Aktionen
- ✅ CLI-Tools: create-task, generate-prompt, send-message, pause-project
- ✅ Kontext-Aggregation: Projekt, Plan, Trigger, Conversation History
- ✅ Plan-Management via `.ai/plan.md` (Git-basiert)
- ✅ Multi-stage Docker Build
- ✅ K8s Job Template mit allen nötigen Secrets

**Design-Prinzipien umgesetzt:**
- Event-driven, kein Polling - Green wird von Engine bei Task-Completion getriggert
- Ephemer - Green plant, erstellt Task, stirbt
- Keine Git-Ops - Außer Plan-Updates via `update-plan.sh`
- Delegation-first - Green darf keinen Code lesen/schreiben

### ✅ Erledigt: Cockpit (Control UI)

**Implementierte Features:**
- ✅ Dashboard mit Projekt-Übersicht und System-Status
- ✅ Projekt-Management (CRUD mit Soft-Delete)
- ✅ GitHub OAuth mit Zwei-Stufen-Autorisierung (pending → authorized)
- ✅ Task-Monitoring mit Echtzeit-Updates (Supabase Realtime)
- ✅ Task-Detail mit vollständigen Logs und Agent-Typ-Erkennung
- ✅ Chat-Interface mit Multi-Conversation Support
- ✅ System-Status (Engine-Heartbeat, Pod-Count, DB-Verbindung)

**Technologie:**
- Next.js 16 mit App Router
- React 19 + Tailwind CSS v4
- RadixUI Komponenten
- NextAuth v5 (GitHub OAuth)
- Supabase Realtime für Live-Updates

### 🔄 Geplant: Blue Agent (Executive Assistant)

**Ziel:** AI-Agent als Hauptassistent, der zwischen User und Green Layer vermittelt

**Geplante Aufgaben:**
- Epic-Verständnis und -Planung auf hoher Ebene
- Kommunikation mit User über Cockpit
- Entscheidungen bei Unklarheiten
- PR-Review Koordination

### 🔄 Geplant: Weitere Cockpit-Features

- Pause/Resume Controls für Projekte
- Kill-Funktion für laufende Jobs
- PR-Review Interface
- Erweiterte Diagnostik

---

## Technische Entscheidungen

| Entscheidung | Begründung |
|--------------|------------|
| PostgreSQL/Supabase | Persistenz, Debugging, Multi-Cluster, Realtime |
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
| Claude-gesteuerter Green | Flexibler als hartcodierte Logik, einfacher anzupassen |
| System-Prompt Ansatz | Verhalten via Prompt definiert, nicht via Code |
| Singleton-Lock via DB | Robust, funktioniert über Node-Restarts hinweg |
| Supabase Realtime | Live-Updates ohne Polling im UI |
| Multi-Conversation | Parallele Diskussionen pro Projekt möglich |
| Soft-Delete | Projekte archivierbar, Daten bleiben erhalten |
