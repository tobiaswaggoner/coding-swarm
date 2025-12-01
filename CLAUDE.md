# CLAUDE.md

Diese Datei bietet Orientierung für Claude Code (claude.ai/code) bei der Arbeit mit diesem Repository.

## Sprachkonventionen

- **Code:** Englisch (Typen, Klassen, Variablen, Kommentare, alles im Code)
- **Dokumentation:** Deutsch (alle Markdown-Dateien, docs/, README, etc.)

## Projektübersicht

Autonomous Coding Swarm - Ein KI-gestütztes Entwicklungssystem für parallele, asynchrone Task-Ausführung über ephemere Kubernetes-Jobs. Das System nutzt Claude Code CLI im Headless-Modus zur autonomen Ausführung von Coding-Aufgaben.

## Architektur (4-Schichten-Modell)

```
┌─────────────────────────────────────────────────────────────┐
│ 🖥️ Cockpit - Control & Monitoring UI (Next.js)              │
│ services/cockpit/                                           │
│ Diagnostik, Monitoring, Epic-Einreichung, PR-Review         │
│ Kommunikationskanal zum Blue Agent (später)                 │
│ NICHT der Blue Layer - sondern das User Interface!          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 🔵 Blue Layer (Geplant) - Executive Assistant (AI Agent)    │
│ services/blue-agent/ (noch nicht implementiert)             │
│ Hauptassistent: Epic-Verständnis, User-Kommunikation        │
│ Vermittelt zwischen User und Green Layer                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ ⚙️ Spawning Engine - Der EINZIGE persistente Prozess         │
│ services/spawning-engine/                                   │
│ Pollt tasks-Tabelle → Spawnt K8s Jobs → Trackt Status       │
│ Triggert Green bei Task-Completion (Event-driven!)          │
│ Verwaltet Concurrency via "addressee" (1 Job pro Addressee) │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 🟢 Green Layer - Project Manager (Ephemerer K8s Job)         │
│ services/green-agent/                                       │
│ Event-driven: Wird bei Task-Completion getriggert           │
│ Plant → Erstellt Task → Stirbt (kein Polling!)              │
│ Führt selbst KEINE Git-Ops aus (alles via Red-Tasks)        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 🔴 Red Layer - Worker Agent (Ephemerer K8s Job)              │
│ services/red-agent/                                         │
│ Task-Typen: CODE, MERGE, REVIEW, FIX, PR, VALIDATE          │
│ MERGED NIE direkt - Merge ist separater Task!               │
└─────────────────────────────────────────────────────────────┘
```

**Kernprinzipien:**
- Alle Agents sind ephemere K8s Jobs. Nur die Spawning Engine ist persistent.
- **Cockpit ≠ Blue Layer:** Das Cockpit ist das User Interface, Blue wird ein AI-Agent
- Green führt keine Git-Operationen aus - **außer** für `.ai/plan.md` (Plan-Updates)
- Red merged nie selbstständig - Merge ist ein separater Task für Review-Möglichkeit
- Das `.ai/` Verzeichnis ist der Projekt-Kontext (Plan, später Specs, etc.)

## Verzeichnisstruktur

```
coding-swarm/
├── services/                    # Alle Services
│   ├── red-agent/              # Worker Agent (CODE, MERGE, REVIEW, etc.)
│   │   ├── entrypoint.sh       # Agent-Lifecycle
│   │   ├── Dockerfile
│   │   └── k8s/                # Job-Manifeste
│   ├── green-agent/            # Project Manager
│   │   ├── src/                # TypeScript (index.ts, db/, git/, plan/, tasks/, decisions/, prompts/)
│   │   ├── entrypoint.sh
│   │   ├── Dockerfile
│   │   └── k8s/
│   ├── cockpit/               # Control & Monitoring UI (Next.js)
│   │   └── README.md
│   └── spawning-engine/        # K8s Job Orchestrator
│       ├── src/                # TypeScript (index.ts, db/, k8s/, engine/)
│       ├── Dockerfile
│       └── k8s/                # Deployment + RBAC
│
├── infrastructure/              # Infrastruktur-Komponenten
│   ├── base-image/             # Docker Base Image (Node, Python, .NET, Claude CLI)
│   │   └── Dockerfile
│   └── migrations/             # SQL-Migrationen für Supabase
│
├── prompts/                     # Externalisierte Prompt-Templates
│   ├── green/                  # Green Agent Prompts
│   └── README.md               # Platzhalter-Dokumentation
│
├── scripts/                     # Build & Deploy Skripte
│   ├── build-and-push.sh       # Alle Images bauen + pushen
│   └── refresh-k8s.sh          # K8s Deployments aktualisieren
│
├── docs/                        # Architektur-Dokumentation
│   ├── initial_idea.md
│   ├── green-layer-design.md
│   └── scenario.md
│
└── CLAUDE.md
```

## Häufige Befehle

### Docker Images bauen & pushen (Empfohlen: Skript)

```bash
# Alle Images bauen und pushen
./scripts/build-and-push.sh

# Nur bauen, nicht pushen
./scripts/build-and-push.sh --no-push

# Mit Base Image (selten nötig)
./scripts/build-and-push.sh --with-base
```

### Manuelles Bauen (falls nötig)

```bash
# Base Image
docker build -t tobiaswaggoner/coding-swarm-base:latest infrastructure/base-image/

# Red Agent
docker build -t tobiaswaggoner/coding-swarm-agent:latest services/red-agent/

# Green Agent (vom Repository-Root wegen prompts/)
docker build -f services/green-agent/Dockerfile -t tobiaswaggoner/green-agent:latest .

# Spawning Engine
docker build -t tobiaswaggoner/spawning-engine:latest services/spawning-engine/
```

### K8s Deployment aktualisieren

```bash
# Deployments neu starten (zieht neue Images)
./scripts/refresh-k8s.sh
```

### Spawning Engine lokal starten

```bash
cd services/spawning-engine
SUPABASE_URL="https://xxx.supabase.co" \
SUPABASE_KEY="eyJ..." \
LOG_LEVEL="debug" \
npx tsx src/index.ts
```

### Kubernetes Initiales Setup

```bash
# Namespace erstellen
kubectl create namespace coding-swarm

# Secret für Worker Agents (Red + Green)
kubectl create secret generic coding-swarm-secrets -n coding-swarm \
  --from-literal=CLAUDE_CODE_OAUTH_TOKEN='<token>' \
  --from-literal=GITHUB_TOKEN='<token>'

# Secret für Spawning Engine (Supabase-Zugang)
kubectl create secret generic spawning-engine-secrets -n coding-swarm \
  --from-literal=SUPABASE_URL='https://xxx.supabase.co' \
  --from-literal=SUPABASE_KEY='eyJ...'

# RBAC + Deployment
kubectl apply -f services/spawning-engine/k8s/rbac.yaml
kubectl apply -f services/spawning-engine/k8s/deployment.yaml
```

### Lokales Docker-Testing

```bash
docker run \
  -e CLAUDE_CODE_OAUTH_TOKEN='<token>' \
  -e GITHUB_TOKEN='<token>' \
  -e REPO_URL='https://github.com/user/repo' \
  -e TASK_PROMPT='Beschreibe die Aufgabe hier' \
  tobiaswaggoner/coding-swarm-agent:latest
```

## Kritische Einschränkungen

1. **Kein ANTHROPIC_API_KEY** - Agents brechen ab wenn gesetzt (Kostenschutz durch Subscription-Only-Auth)
2. **OAuth Token erforderlich** - Generieren via `claude setup-token` auf Host, übergeben als `CLAUDE_CODE_OAUTH_TOKEN`
3. **Non-root Ausführung** - Container läuft als `aiworker` (UID 1000) für K8s SecurityContext-Kompatibilität
4. **Ein Task = Ein Branch** - Isolation verhindert Merge-Konflikte bei paralleler Arbeit
5. **Kein Conversation-Modus** - Agents führen einmal aus und terminieren (Erfolg oder Fehler, kein Hin-und-Her)
6. **Red merged NIE** - Merge ist immer ein separater Task (für Review und Konflikt-Isolation)
7. **Green führt keine Git-Ops aus** - Außer für `.ai/plan.md` (Plan-Updates darf Green committen)

## Agent Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `CLAUDE_CODE_OAUTH_TOKEN` | Ja | Claude Subscription OAuth Token |
| `GITHUB_TOKEN` | Ja | GitHub PAT für Git-Operationen und gh CLI |
| `REPO_URL` | Ja | Zu clonendes Repository |
| `TASK_PROMPT` | Ja | Task-Beschreibung für Claude Code CLI |
| `BRANCH` | Nein | Auszucheckender Branch (Standard: main) |
| `GIT_USER_EMAIL` | Nein | Committer E-Mail |
| `GIT_USER_NAME` | Nein | Committer Name |
| `OUTPUT_FORMAT` | Nein | `text`, `json`, oder `stream-json` (Standard: stream-json) |
| `PROMPTS_DIR` | Nein | Pfad zu Prompt-Templates (Standard: /prompts/green, nur Green Agent) |

## Zentrale Design-Entscheidungen

- **PostgreSQL statt Redis** - Persistenter State für Debugging; einfache manuelle SQL-Intervention
- **Addressee-basierte Concurrency** - Gleicher Addressee = sequentiell; unterschiedlich = parallel
- **Iterative Planung** - Green Agent plant nur nächsten Schritt, nicht ganzes Epic im Voraus
- **Quality Gates als Tasks** - Review/Test sind normale Tasks mit anderen Prompts
- **Pläne in Git** - `.ai/plan.md` im Repo gespeichert, nicht in Datenbank (Single Source of Truth)
- **`.ai/` Verzeichnis** - Enthält Plan + Kontext, von Green gepflegt
- **Step-Branches löschen** - Nach erfolgreichem Merge automatisch entfernen
- **Event-driven statt Polling** - Green wird bei Task-Completion getriggert, keine Idle-Kosten
- **Merge als separater Task** - Ermöglicht Review vor Integration, Konflikt-Isolation
- **Task-Typen** - CODE, MERGE, REVIEW, FIX, PR, VALIDATE für klare Trennung der Verantwortlichkeiten
- **PR via Red-Task** - Konsistentes Modell, Green führt selbst keine Git-Ops aus
- **Externalisierte Prompts** - Alle Prompts in `prompts/` Verzeichnis, mountbar via K8s ConfigMap für Änderungen ohne Rebuild
- **GIT_ASKPASS Auth** - SOTA Git-Authentifizierung ohne Token in URLs (verhindert Log-Leaks)
- **Multi-Stage Docker Builds** - Schnellere Iteration durch optimierte Layer-Caching
- **Service-orientierte Struktur** - Klare Trennung in `services/` und `infrastructure/`
