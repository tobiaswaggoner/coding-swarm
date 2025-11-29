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
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Spawning Engine - Der EINZIGE persistente Prozess           │
│ Pollt tasks-Tabelle → Spawnt K8s Jobs → Trackt Status       │
│ Verwaltet Concurrency via "addressee" (1 Job pro Addressee) │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Green Layer (Zukunft) - Project Manager (Ephemerer K8s Job) │
│ Pflegt .ai/plan.md → Spawnt Red-Tasks iterativ              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Red Layer (Aktueller Spike) - Worker Agent (Ephemerer K8s)  │
│ Clont Repo → Führt claude -p aus → Committed/pusht Änderungen│
└─────────────────────────────────────────────────────────────┘
```

**Kernprinzip:** Alle Agents sind ephemere K8s Jobs. Nur die Spawning Engine ist persistent.

## Verzeichnisstruktur

- `base-image/` - Gemeinsames Docker-Base-Image (Node 25, Python 3.13, .NET 9, Claude CLI, gh CLI)
- `spike-01-container/` - Red Agent Implementierung (aktueller Fokus)
  - `entrypoint.sh` - Agent-Lifecycle: Secrets validieren → Repo clonen → Claude CLI ausführen
  - `k8s/` - Kubernetes-Manifeste (job.yaml, namespace.yml)
- `docs/` - Architektur-Dokumentation (`initial_idea.md` ist das primäre Design-Dokument)

## Häufige Befehle

### Docker Images bauen & pushen

```bash
# Base Image
docker build -t tobiaswaggoner/coding-swarm-base:latest base-image/
docker push tobiaswaggoner/coding-swarm-base:latest

# Agent Image
docker build -t tobiaswaggoner/coding-swarm-agent:latest spike-01-container/
docker push tobiaswaggoner/coding-swarm-agent:latest
```

### Kubernetes Deployment

```bash
# Initiales Setup
kubectl create namespace coding-swarm
kubectl create secret generic coding-swarm-secrets -n coding-swarm \
  --from-literal=CLAUDE_CODE_OAUTH_TOKEN='<token>' \
  --from-literal=GITHUB_TOKEN='<token>'

# Deployen und überwachen
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

## Zentrale Design-Entscheidungen

- **PostgreSQL statt Redis** - Persistenter State für Debugging; einfache manuelle SQL-Intervention
- **Addressee-basierte Concurrency** - Gleicher Addressee = sequentiell; unterschiedlich = parallel
- **Iterative Planung** - Green Agent plant nur nächsten Schritt, nicht ganzes Epic im Voraus
- **Quality Gates als Tasks** - Review/Test sind normale Tasks mit anderen Prompts
- **Pläne in Git** - `.ai/plan.md` im Repo gespeichert, nicht in Datenbank (Single Source of Truth)
