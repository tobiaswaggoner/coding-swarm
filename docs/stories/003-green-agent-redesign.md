# User Story 003: Green Agent Redesign - Prompt-basierte Entscheidungen

## Übersicht

Der Green Agent soll von einer deterministischen State Machine zu einem prompt-basierten AI-Agent umgebaut werden. Claude soll die Entscheidungen treffen, nicht hardcodierte Switch-Statements.

## Problem

### Aktueller Zustand

Der Green Agent hat ~478 Zeilen hardcodierte Decision-Engine (`decisions/engine.ts`):

```typescript
// Aktuell: Deterministische Logik
switch (triggerTask.task_type) {
  case "CODE":
    if (!result.success) return PAUSE_FOR_REVIEW;
    if (result.branch) return CREATE_MERGE_TASK;
    // ...
  case "MERGE":
    markStepDone();
    if (allDone) return CREATE_PR_TASK;
    // ...
}
```

### Probleme

1. **Künstliche Task-Typen**: CODE, MERGE, PR sind alle "Arbeit für Red Agent"
2. **Keine Flexibilität**: Lineare Step-Progression, keine parallelen Tasks
3. **Keine User-Kommunikation**: USER_MESSAGE nicht implementiert
4. **Keine intelligenten Entscheidungen**: Claude wird nur für Plan-Generierung genutzt

## Neues Konzept

### Paradigmenwechsel

```
ALT:  Engine → Green → Hardcodierte Logik → Task
NEU:  Engine → Green → Claude (mit Tools) → Claude entscheidet → Tool-Calls
```

### Green Agent Kontext

Green muss verstehen:
- Er ist Teil eines **AI Swarms**
- Er kann Tasks an **Red Agents** delegieren
- Red Agents sind die **einzigen mit Code-Zugriff**
- Red Agents können: kodieren, analysieren, mergen, PRs erstellen
- **Alles am Code** (außer `.ai/` Markdown) läuft über Red Agents

### Task-Typ Vereinfachung

```typescript
// ALT: Viele spezifische Typen
type TaskType = "CODE" | "MERGE" | "REVIEW" | "FIX" | "PR" | "VALIDATE";

// NEU: Ein generischer Typ
type TaskType = "WORK";  // Was der Task tut, ergibt sich aus dem Prompt
```

### Tools für Green Agent

| Tool | Beschreibung |
|------|--------------|
| `delegate_to_red` | Erstellt Task für Red Agent (kodieren, mergen, PR, etc.) |
| `send_message` | Schreibt Nachricht in Conversation (Antwort an User) |
| `update_plan` | Ändert `.ai/plan.md` |
| `request_clarification` | Stellt Rückfrage an User |

## Architektur-Entscheidung: Tools als Bash-Skripte

### Warum Claude Code beibehalten?

Claude Code CLI bietet wichtige Agent-Capabilities:
- RAG und File-Search
- Code-Editing mit Kontext
- Automatisches Tooling (Lint, Build, etc.)
- OAuth-basiertes Billing (Subscription)

Ein Wechsel zur Claude API würde all das verlieren. **Wir bleiben bei Claude Code.**

### Lösung: Skripte statt native Tools

Claude Code kann jederzeit Bash ausführen. Unsere "Tools" werden als Skripte implementiert:

```
services/green-agent/
├── scripts/                    # "Tools" als Bash-Skripte
│   ├── delegate-to-red.sh     # Task für Red Agent erstellen
│   ├── send-message.sh        # Nachricht in Conversation schreiben
│   ├── update-plan.sh         # Plan aktualisieren
│   └── request-clarification.sh
├── src/
│   └── ...
```

### Skript-Definitionen

#### `delegate-to-red.sh`
```bash
#!/bin/bash
# Erstellt einen Task für einen Red Agent
#
# Usage: ./scripts/delegate-to-red.sh <prompt> [branch]
#
# Arguments:
#   prompt  - Die Aufgabenbeschreibung für den Red Agent
#   branch  - Optional: Ziel-Branch (default: integration branch)
#
# Example:
#   ./scripts/delegate-to-red.sh "Implementiere User-Login mit JWT" "feature/auth"

PROMPT="$1"
BRANCH="${2:-$INTEGRATION_BRANCH}"

# Schreibt Task in Supabase
node /app/dist/cli/create-task.js \
  --project-id "$PROJECT_ID" \
  --prompt "$PROMPT" \
  --branch "$BRANCH" \
  --repo-url "$REPO_URL"
```

#### `send-message.sh`
```bash
#!/bin/bash
# Sendet eine Nachricht an den User (in aktive Conversation)
#
# Usage: ./scripts/send-message.sh <content>
#
# Arguments:
#   content - Die Nachricht an den User (Markdown erlaubt)
#
# Example:
#   ./scripts/send-message.sh "Ich habe die Analyse abgeschlossen. Folgende Schritte sind nötig: ..."

CONTENT="$1"

node /app/dist/cli/send-message.js \
  --conversation-id "$CONVERSATION_ID" \
  --role "green" \
  --content "$CONTENT"
```

#### `update-plan.sh`
```bash
#!/bin/bash
# Aktualisiert den Projektplan (.ai/plan.md)
#
# Usage: ./scripts/update-plan.sh <changes>
#
# Arguments:
#   changes - Beschreibung der Änderungen (wird als Commit-Message verwendet)
#
# Note: Die eigentliche Änderung an plan.md macht Claude Code direkt.
#       Dieses Skript committed und pusht die Änderung.
#
# Example:
#   ./scripts/update-plan.sh "Step 2 als abgeschlossen markiert"

CHANGES="$1"

git add .ai/plan.md
git commit -m "plan: $CHANGES"
git push
```

### Prompt-Integration

Im System-Prompt für Green werden die Skripte wie Tools dokumentiert:

```markdown
## Verfügbare Aktionen

Du hast folgende Skripte zur Verfügung. Führe sie via Bash aus:

### Task an Red Agent delegieren
```bash
./scripts/delegate-to-red.sh "<prompt>" "[branch]"
```
- `prompt`: Detaillierte Aufgabenbeschreibung für den Red Agent
- `branch`: Optional, Ziel-Branch

Verwende dies für ALLE Code-Änderungen: Implementierung, Merge, PR, Tests, etc.

### Nachricht an User senden
```bash
./scripts/send-message.sh "<content>"
```
- `content`: Deine Antwort (Markdown erlaubt)

Verwende dies um mit dem User zu kommunizieren.

### Plan aktualisieren
Ändere `.ai/plan.md` direkt und führe dann aus:
```bash
./scripts/update-plan.sh "<commit-message>"
```

### Rückfrage stellen
```bash
./scripts/request-clarification.sh "<question>"
```
Dies sendet eine Nachricht und pausiert das Projekt bis zur Antwort.
```

### Vorteile dieses Ansatzes

| Aspekt | Vorteil |
|--------|---------|
| **Einfachheit** | Keine MCP-Server, keine API-Integration |
| **Transparenz** | Skript-Aufrufe erscheinen im JSONL-Log |
| **Erweiterbarkeit** | Neue "Tools" = neue Skripte |
| **Debugging** | Skripte einzeln testbar |
| **Claude Code Features** | RAG, File-Search, OAuth bleiben erhalten |

## CLI-Module für Skripte

Die Skripte rufen Node.js CLI-Module auf, die die eigentliche Arbeit machen:

```
services/green-agent/
├── scripts/                    # Bash-Wrapper (für Claude Code)
│   ├── delegate-to-red.sh
│   ├── send-message.sh
│   └── ...
├── src/
│   ├── cli/                   # CLI-Einstiegspunkte
│   │   ├── create-task.ts     # Task in Supabase erstellen
│   │   ├── send-message.ts    # Message in Supabase erstellen
│   │   └── ...
│   ├── db/                    # Supabase Client
│   └── index.ts               # Haupt-Entrypoint (wird zu Prompt-Runner)
```

### Wiederverwendbarkeit

Diese CLI-Module können auch vom Blue Agent genutzt werden:
- Gleiche Skripte, anderer Kontext
- Blue verwendet `send-message.sh` mit `--role blue`
- Shared Supabase-Client

## Akzeptanzkriterien

### Phase 1: Skripte & CLI-Module
- [ ] `scripts/` Verzeichnis mit Bash-Skripten erstellen
- [ ] `src/cli/create-task.ts` implementieren
- [ ] `src/cli/send-message.ts` implementieren
- [ ] Skripte im Docker-Image verfügbar machen
- [ ] Manueller Test: Skripte einzeln ausführbar

### Phase 2: Green Agent Umbau
- [ ] `decisions/engine.ts` entfernen
- [ ] `index.ts` vereinfachen: Nur noch Prompt bauen + Claude Code starten
- [ ] System-Prompt mit Skript-Dokumentation erstellen
- [ ] Task-Typ Spalte in DB optional machen (oder entfernen)
- [ ] USER_MESSAGE Trigger-Kontext implementieren

### Phase 3: Integration & Test
- [ ] Spawning Engine: Task-Typ-Logik entfernen (falls vorhanden)
- [ ] Cockpit: Task-Typ-Badge durch Prompt-Preview ersetzen
- [ ] End-to-End Test: User Message → Green → delegate-to-red → Red → Completion
- [ ] End-to-End Test: Neues Projekt → Green plant → delegate-to-red → Red implementiert

## Technische Details

### Neuer Green Agent Flow

```
1. Entrypoint (entrypoint.sh)
   ├─ Repo klonen
   ├─ Umgebungsvariablen setzen (PROJECT_ID, CONVERSATION_ID, etc.)
   └─ Claude Code starten mit generiertem Prompt

2. Prompt-Generierung (vor Claude Code Start)
   ├─ Projekt-Info aus Supabase laden
   ├─ Plan (.ai/plan.md) aus Repo lesen
   ├─ Trigger-Context laden (was hat diesen Run ausgelöst?)
   ├─ Conversation laden (falls USER_MESSAGE)
   └─ System-Prompt + User-Prompt zusammenbauen

3. Claude Code Execution
   ├─ Claude analysiert Kontext
   ├─ Claude entscheidet was zu tun ist
   └─ Claude führt Skripte aus:
       ├─ ./scripts/delegate-to-red.sh "..." → Task erstellt
       ├─ ./scripts/send-message.sh "..." → User informiert
       └─ ./scripts/update-plan.sh "..." → Plan committed

4. Terminieren
   └─ Claude Code beendet sich, Container stirbt
```

### Entrypoint-Änderung

```bash
# ALT: Komplexe TypeScript-Logik
node /app/dist/index.js

# NEU: Prompt generieren, dann Claude Code
PROMPT=$(node /app/dist/generate-prompt.js)
claude -p "$PROMPT" --dangerously-skip-permissions --output-format stream-json
```

### Beispiel: Green System Prompt

```markdown
Du bist der Project Manager (Green Agent) im Coding Swarm System.

## Deine Rolle
- Du planst und koordinierst die Entwicklungsarbeit
- Du hast KEINEN direkten Code-Zugriff (außer auf .ai/ Markdown-Dateien)
- Du delegierst Implementierungsarbeit an Red Agents

## Red Agents
Red Agents sind autonome Coding-Agenten. Sie können:
- Code schreiben und ändern
- Branches erstellen und mergen
- Pull Requests erstellen
- Tests ausführen
- Code analysieren

**Alles, was am Code passieren soll, MUSS über einen Red Agent laufen.**

## Verfügbare Skripte

### Task an Red Agent delegieren
```bash
./scripts/delegate-to-red.sh "<detaillierte-aufgabe>" "[ziel-branch]"
```
Verwende dies für ALLE Code-Arbeiten.

### Nachricht an User senden
```bash
./scripts/send-message.sh "<deine-nachricht>"
```
Markdown ist erlaubt.

### Plan aktualisieren
Bearbeite `.ai/plan.md` direkt, dann:
```bash
./scripts/update-plan.sh "<was-wurde-geändert>"
```

### Rückfrage stellen (pausiert Projekt)
```bash
./scripts/request-clarification.sh "<deine-frage>"
```

## Aktueller Kontext

### Projekt
{project_info}

### Plan
{plan_content}

### Auslöser dieses Runs
{trigger_context}

### Conversation (falls User-Message)
{conversation_history}

## Deine Aufgabe
Analysiere die Situation und führe die passenden Aktionen aus.
```

## Abhängigkeiten

- Story 002 (Status-Vereinfachung) sollte vorher erledigt sein
- Keine externen Dependencies (bleibt bei Claude Code CLI)

## Aufwand

Geschätzt: Mittel-Groß (3-5 Tage)
- Phase 1 (Skripte & CLI): 1 Tag
- Phase 2 (Green Umbau): 2 Tage
- Phase 3 (Integration & Test): 1-2 Tage

## Priorität

Hoch - Kernstück der flexiblen Agent-Architektur
