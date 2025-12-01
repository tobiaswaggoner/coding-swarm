# CLAUDE.md

Diese Datei bietet Orientierung für Claude Code (claude.ai/code) bei der Arbeit mit diesem Repository.

## Sprachkonventionen

- **Code:** Englisch (Typen, Klassen, Variablen, Kommentare, alles im Code)
- **Dokumentation:** Deutsch (alle Markdown-Dateien, docs/, README, etc.)

## Projektübersicht

Autonomous Coding Swarm - Ein KI-gestütztes Entwicklungssystem für parallele, asynchrone Task-Ausführung über ephemere Kubernetes-Jobs. Das System nutzt Claude Code CLI im Headless-Modus zur autonomen Ausführung von Coding-Aufgaben.

## Architektur (3-Schichten-Modell)

```
┌─────────────────────────────────────────────────────────────┐
│ Blue Layer (Zukunft) - Executive UI (Next.js)               │
│ User reicht Epics ein → Schreibt in PostgreSQL              │
│ PR-Review → Änderungswünsche → Triggert Green               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Spawning Engine - Der EINZIGE persistente Prozess           │
│ Pollt tasks-Tabelle → Spawnt K8s Jobs → Trackt Status       │
│ Triggert Green bei Task-Completion (Event-driven!)          │
│ Verwaltet Concurrency via "addressee" (1 Job pro Addressee) │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Green Layer (Nächster Schritt) - Project Manager            │
│ Event-driven: Wird bei Task-Completion getriggert           │
│ Plant → Erstellt Task → Stirbt (kein Polling!)              │
│ Führt selbst KEINE Git-Ops aus (alles via Red-Tasks)        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Red Layer (Implementiert) - Worker Agent (Ephemerer K8s)    │
│ Task-Typen: CODE, MERGE, REVIEW, FIX, PR, VALIDATE          │
│ MERGED NIE direkt - Merge ist separater Task!               │
└─────────────────────────────────────────────────────────────┘
```

**Kernprinzipien:**
- Alle Agents sind ephemere K8s Jobs. Nur die Spawning Engine ist persistent.
- Green führt keine Git-Operationen aus - **außer** für `.ai/plan.md` (Plan-Updates)
- Red merged nie selbstständig - Merge ist ein separater Task für Review-Möglichkeit
- Das `.ai/` Verzeichnis ist der Projekt-Kontext (Plan, später Specs, etc.)

## Verzeichnisstruktur

- `base-image/` - Gemeinsames Docker-Base-Image (Node 25, Python 3.13, .NET 9, Claude CLI, gh CLI)
- `spike-01-container/` - Red Agent Implementierung
  - `entrypoint.sh` - Agent-Lifecycle: Secrets validieren → Repo clonen → Claude CLI ausführen
  - `k8s/` - Kubernetes-Manifeste (job.yaml, namespace.yml)
- `green-agent/` - Green Agent (Project Manager) Implementierung
  - `src/` - TypeScript Source Code (index.ts, config.ts, db/, git/, plan/, tasks/, decisions/, prompts/)
  - `k8s/` - Kubernetes-Manifeste (job.yaml Template)
  - `Dockerfile` - Container-Image für K8s Deployment
  - `entrypoint.sh` - Agent-Lifecycle: Secrets validieren → Repo clonen → Green Agent ausführen
- `spawning-engine/` - Spawning Engine (TypeScript)
  - `src/` - TypeScript Source Code (index.ts, config.ts, db/, k8s/, engine/)
  - `k8s/` - Kubernetes-Manifeste (deployment.yaml, rbac.yaml)
  - `Dockerfile` - Container-Image für K8s Deployment
- `prompts/` - Externalisierte Prompt-Templates
  - `green/` - Green Agent Prompts (code.md, merge.md, review.md, fix.md, pr.md, validate.md, plan-generation.md)
  - `README.md` - Dokumentation der Platzhalter und K8s ConfigMap-Nutzung
- `migrations/` - SQL-Migrationen für Supabase
- `scripts/` - Hilfs-Skripte (Test-Task erstellen, etc.)
- `docs/` - Architektur-Dokumentation:
  - `initial_idea.md` - Übersicht und Vision
  - `green-layer-design.md` - Technisches Design für Green Agent
  - `scenario.md` - Detailliertes Durchspiel-Szenario (Snake Clone)

## Häufige Befehle

### Docker Images bauen & pushen

```bash
# Base Image
docker build -t tobiaswaggoner/coding-swarm-base:latest base-image/
docker push tobiaswaggoner/coding-swarm-base:latest

# Red Agent Image
docker build -t tobiaswaggoner/coding-swarm-agent:latest spike-01-container/
docker push tobiaswaggoner/coding-swarm-agent:latest

# Green Agent Image (WICHTIG: vom Repository-Root bauen wegen prompts/)
docker build -f green-agent/Dockerfile -t tobiaswaggoner/green-agent:latest .
docker push tobiaswaggoner/green-agent:latest

# Spawning Engine Image
docker build -t tobiaswaggoner/spawning-engine:latest spawning-engine/
docker push tobiaswaggoner/spawning-engine:latest
```

### Spawning Engine lokal starten

```bash
cd spawning-engine
SUPABASE_URL="https://xxx.supabase.co" \
SUPABASE_KEY="eyJ..." \
LOG_LEVEL="debug" \
npx tsx src/index.ts
```

### Kubernetes Deployment

```bash
# Initiales Setup - Namespace erstellen
kubectl create namespace coding-swarm

# Secret für Worker Agents (Red Agents)
kubectl create secret generic coding-swarm-secrets -n coding-swarm \
  --from-literal=CLAUDE_CODE_OAUTH_TOKEN='<token>' \
  --from-literal=GITHUB_TOKEN='<token>'

# Secret für Spawning Engine (Supabase-Zugang)
kubectl create secret generic spawning-engine-secrets -n coding-swarm \
  --from-literal=SUPABASE_URL='https://xxx.supabase.co' \
  --from-literal=SUPABASE_KEY='eyJ...'

# RBAC für Spawning Engine
kubectl apply -f spawning-engine/k8s/rbac.yaml

# Spawning Engine deployen
kubectl apply -f spawning-engine/k8s/deployment.yaml
kubectl logs -f -n coding-swarm deployment/spawning-engine

# Red Agent Job manuell starten (zum Testen)
kubectl apply -f spike-01-container/k8s/job.yaml
kubectl logs -f -n coding-swarm job/red-agent-spike
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
