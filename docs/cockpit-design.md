# Cockpit Design - Konzept & Anforderungen

## Übersicht

Das Cockpit ist das zentrale User Interface zur Kontrolle und Überwachung des Coding Swarm Systems. Es läuft auf Vercel und kommuniziert ausschließlich über Supabase mit dem Cluster.

**Wichtige Architektur-Entscheidung:** Der K8s-Cluster soll komplett hinter einer Firewall liegen und von außen nicht erreichbar sein. Supabase dient als einzige Kommunikationsschnittstelle zwischen Cockpit und Cluster. Ein internes Cluster-Monitoring schreibt Status-Informationen in die Datenbank.

---

## Authentifizierung

- **Framework:** NextAuth v5 (Auth.js)
- **Provider:** GitHub OAuth
- **Zwei-Stufen-Autorisierung:**
  1. **Seed-User:** Automatisch autorisiert (konfiguriert in `src/auth.ts`)
  2. **Neue User:** Status `pending` bis von Admin freigegeben

### User-Status

| Status | Zugriff |
|--------|---------|
| `pending` | Nur Warteseite (`/pending`) |
| `authorized` | Voller Zugriff inkl. User-Verwaltung |
| `blocked` | Login verweigert |

### Datenbank-Schema

```sql
CREATE TABLE cockpit_users (
    id              UUID PRIMARY KEY,
    github_id       VARCHAR(255) UNIQUE NOT NULL,
    github_username VARCHAR(255),
    email           VARCHAR(255),
    name            VARCHAR(255),
    avatar_url      TEXT,
    status          VARCHAR(50) DEFAULT 'pending',  -- pending, authorized, blocked
    authorized_by   UUID REFERENCES cockpit_users(id),
    authorized_at   TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Dashboard-Ansicht (Hauptseite)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Logo (Primary) | Navigation | Theme Toggle | User   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Projekt-Kacheln (Grid, responsive)                         │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Project A   │  │ Project B   │  │ Project C   │         │
│  │ [Active]    │  │ [Paused]    │  │ [Failed]    │         │
│  │             │  │             │  │             │         │
│  │ Workers: 2  │  │ Workers: 0  │  │ Workers: 0  │         │
│  │ Task: Auth  │  │ Task: —     │  │ Task: DB    │         │
│  │ 1/5 tasks   │  │ 3/3 tasks   │  │ 2/4 tasks   │         │
│  │             │  │             │  │             │         │
│  │ 2m ago      │  │ 1h ago      │  │ 5m ago      │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Footer: Pods ● 0/10 | Engine ● 7s ago | Supabase ● Connected│
└─────────────────────────────────────────────────────────────┘
```

### Projekt-Kacheln (shadcn Card)

Jede Kachel zeigt kompakt:

| Element | Beschreibung |
|---------|--------------|
| **Projektname** | CardTitle |
| **Status-Badge** | Active, Paused, Review, Done, Failed |
| **Workers** | Anzahl laufender Red-Tasks (oder "idle") |
| **Task** | Aktuelles Epic (gekürzt) |
| **Progress** | completed/total tasks |
| **Letzte Aktivität** | Relative Zeit (2m ago, 1h ago, etc.) |

**Sortierung:** Nach letzter Aktivität (neueste zuerst)

### System-Status (Footer)

Kompakte Darstellung:
- **Pods:** Laufende/Maximale Jobs
- **Engine:** Heartbeat-Status aus `engine_lock` Tabelle
- **Supabase:** Verbindungsstatus
- **Overall:** System healthy / System degraded (Badge)

---

## Projektansicht (Detail)

### Task-Historie mit Agent-Visualisierung

Die Task-Liste zeigt den Workflow zwischen Agents durch farbige linke Ränder:

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Projects    Project Name         [Active]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  RUNNING (1)                                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │🟢│ ✓ Plan next implementation step...        2m ago    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  COMPLETED (3)                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │🔴│ ✓ Implement user authentication...        5m ago    ││
│  │🟢│ ✓ Create MERGE task for feature...       10m ago    ││
│  │🔴│ ✓ Merge feature branch into main...      12m ago    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Agent-Farben:**
| Agent | Farbe | Beschreibung |
|-------|-------|--------------|
| 🔴 Red | `border-l-red-500` | Coding Agent (Worker) |
| 🟢 Green | `border-l-green-500` | Project Manager |
| 🔵 Blue | `border-l-blue-500` | Executive Assistant (geplant) |

**Agent-Erkennung:** Aus dem `addressee`-Feld:
- `project-mgr-*` → Green
- `worker-*` → Red
- `blue-*` / `executive-*` → Blue

---

## Task-Detail-Ansicht

### Agent-Banner

Prominenter farbiger Header zeigt den ausführenden Agent:

```
┌─────────────────────────────────────────────────────────────┐
│████████████████████ ROTER BANNER ███████████████████████████│
│ [CPU]  Coding Agent                      [CODE Task]        │
│        Worker executing code tasks                          │
├─────────────────────────────────────────────────────────────┤
│ ← Back to Project                                           │
│                                                             │
│ ┌─Branch────┐ ┌─Created───┐ ┌─Started───┐ ┌─Completed─┐    │
│ │ feat/...  │ │ 21h ago   │ │ 21h ago   │ │ 21h ago   │    │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Agent-Konfiguration:**
| Agent | Label | Icon | Hintergrund |
|-------|-------|------|-------------|
| Red | Coding Agent | `Cpu` | `bg-red-600` |
| Green | Project Manager | `FolderKanban` | `bg-green-600` |
| Blue | Executive Assistant | `Bot` | `bg-blue-600` |

### Collapsible Sections

Drei separate, ein-/ausklappbare Bereiche:

```
┌─────────────────────────────────────────────────────────────┐
│ Task Prompt                                    [▼ expanded] │
├─────────────────────────────────────────────────────────────┤
│ Markdown-formatierter Prompt-Text                           │
│ - Listen werden gerendert                                   │
│ - **Bold** und `code` funktionieren                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Result                                         [▼ expanded] │
├─────────────────────────────────────────────────────────────┤
│ ✓ Success                                                   │
│ Markdown-formatierte Summary mit Headlines, Listen, etc.    │
│ ─────────────────────────────────────────────────────────── │
│ $ Cost: $0.21  ⏱ Duration: 2m 3s  🔗 View Pull Request     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Execution (Log size: 45.2 KB)                 [▶ collapsed] │
└─────────────────────────────────────────────────────────────┘
```

**Default-Zustände:**
- Task Prompt: expanded
- Result: expanded
- Execution: collapsed

### Markdown-Rendering

Alle Text-Inhalte (Prompt, Result Summary) werden als Markdown gerendert:
- Headlines (`#`, `##`, `###`)
- Listen (nummeriert und Bullet-Points)
- Code-Blöcke und Inline-Code
- Bold/Italic
- Kompaktes Styling (`prose-xs`) passend zur UI

---

## User-Verwaltung (`/admin/users`)

Nur für autorisierte User sichtbar.

### Features

- Liste aller User (gruppiert nach Status)
- Pending-User freischalten (Authorize)
- User blockieren (Block)
- Anzeige: Avatar, Name, E-Mail, GitHub-Username, Join-Datum, Last Login

---

## Projektverwaltung (`/admin/projects`)

### Übersicht

Zentrale Verwaltung aller Projekte im System. Ermöglicht das Anlegen neuer Projekte, Bearbeiten bestehender und Archivieren (Soft Delete).

### Projekt hinzufügen

**Route:** `/admin/projects/new`

**Pflichtfelder:**
| Feld | Beschreibung | Validierung |
|------|--------------|-------------|
| **Name** | Anzeigename des Projekts | Nicht leer, max 100 Zeichen |
| **GitHub Repo URL** | URL zum Repository | Gültige GitHub URL (`https://github.com/...`) |
| **Default Branch** | Haupt-Branch (meist `main`) | Default: `main` |

**Optionale Felder:**
| Feld | Beschreibung |
|------|--------------|
| **Integration Branch** | Branch für Feature-Integration |
| **Epic** | Initiale Epic-Beschreibung |

**Projekt-ID:** Wird aus dem Projektnamen generiert (lowercase, kebab-case). Muss einzigartig sein.

### Projekt bearbeiten

**Route:** `/admin/projects/[id]/edit`

**Editierbare Felder:**
- Name
- Epic (Current Task)
- Integration Branch
- Status (Active, Paused, etc.)

**Nicht editierbar:**
- Repo URL (unveränderlich nach Erstellung)
- ID (unveränderlich)

### Projekt archivieren (Soft Delete)

**Aktion:** "Archive Project" Button mit Bestätigungs-Dialog

**Effekt:**
- Setzt `deleted = true`
- Setzt `deleted_at = NOW()`
- Setzt `deleted_by = current_user.id`
- Projekt verschwindet aus Dashboard und Listen
- Tasks bleiben erhalten (für Auditing)

**Kein hartes Löschen:** Projekte können nicht permanent gelöscht werden. Bei Bedarf: SQL-Admin-Eingriff.

### Archivierte Projekte anzeigen

**Toggle im Dashboard:** "Show archived" Checkbox zeigt archivierte Projekte (grau, mit Badge "Archived")

### Datenbank-Schema Erweiterung

```sql
-- Migration: 005_projects_soft_delete
ALTER TABLE projects ADD COLUMN deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN deleted_by UUID REFERENCES cockpit_users(id);

CREATE INDEX idx_projects_not_deleted ON projects(deleted) WHERE deleted = FALSE;
```

### UI-Komponenten

| Komponente | Verwendung |
|------------|------------|
| `ProjectForm` | Shared Form für Create/Edit |
| `ProjectList` | Admin-Liste aller Projekte |
| `ArchiveDialog` | Bestätigungs-Modal für Archivierung |

---

## Kommunikation mit Green Agent (Phase 3, Teil 2)

### Übersicht

Chat-basierte Kommunikation zwischen User und Green Agent. Der User kann in natürlicher Sprache Anweisungen geben, Fragen stellen und Kontext bereitstellen. Green Agent antwortet und entscheidet, ob Coding-Tasks nötig sind.

**Architektur-Prinzip:** Keine direkte TCP/IP-Verbindung zum Cluster. Kommunikation läuft ausschließlich über Datenbank (Supabase). Green wird per Task geweckt.

```
┌─────────┐     ┌──────────────┐     ┌─────────────┐
│  User   │────▶│  Conversations│────▶│   Tasks     │
│(Cockpit)│     │  + Messages  │     │(USER_MESSAGE)│
└─────────┘     └──────────────┘     └─────────────┘
                       ▲                    │
                       │                    ▼
                       │              ┌─────────────┐
                       └──────────────│    Green    │
                         (Antworten)  │   Agent     │
                                      └─────────────┘
```

### Datenbank-Schema

```sql
-- Migration: 006_conversations.sql

-- Conversations gruppieren Messages zu einem Thema/Dialog
CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      VARCHAR(255) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title           VARCHAR(255),  -- Auto-generiert, aber editierbar
    status          VARCHAR(50) DEFAULT 'active',  -- active, archived
    created_by      UUID REFERENCES cockpit_users(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages innerhalb einer Conversation
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            VARCHAR(50) NOT NULL,  -- 'user', 'green', 'blue', 'system'
    content         TEXT NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Task-Verknüpfung: Welchen Task hat diese Nachricht ausgelöst?
    triggers_task_id UUID REFERENCES tasks(id)
);

-- Indizes
CREATE INDEX idx_conversations_project ON conversations(project_id);
CREATE INDEX idx_conversations_status ON conversations(project_id, status);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(conversation_id, created_at);
```

### Task-Integration

Wenn der User eine Nachricht schreibt:

1. Message wird in `messages` Tabelle gespeichert (role: "user")
2. Task wird automatisch erstellt:
   ```json
   {
     "addressee": "project-mgr-{project_id}",
     "task_type": "USER_MESSAGE",
     "prompt": "New user message in conversation {conv_id}. Read all messages and respond.",
     "project_id": "{project_id}"
   }
   ```
3. `triggers_task_id` in der Message wird auf den neuen Task gesetzt
4. Green Agent wird von Engine gespawnt
5. Green liest alle Messages der Conversation + Context-Files
6. Green antwortet (neue Message mit role: "green")
7. Green entscheidet: Nur Antwort → Task done. Arbeit nötig → CODE-Task erstellen.

### Context-Files (.ai/ Verzeichnis)

**Wichtige Entscheidung:** Context-Files werden **nicht** in der Datenbank gespeichert, sondern direkt ins Git-Repository committed (`.ai/` Verzeichnis). Green Agent (Claude Code) kann sie per Tool-Call selbst finden und lesen.

**Verzeichnisstruktur im Projekt-Repo:**
```
.ai/
├── plan.md           # Aktueller Plan (von Green gepflegt)
├── context/          # Hochgeladene Kontext-Dateien
│   ├── spec.md       # Feature-Spezifikation
│   ├── research.md   # Externe Analyse (ChatGPT, Gemini, etc.)
│   └── decisions.md  # Architektur-Entscheidungen
└── instructions/     # Spezielle Anweisungen
    └── guidelines.md
```

**Referenzierung im Chat:**
- User erwähnt Dateinamen im Chat: "Berücksichtige `.ai/context/spec.md`"
- System-Prompt informiert Green über das `.ai/` Verzeichnis
- Green (Claude Code) findet und liest Dateien selbstständig per Tool-Call

### Chat-Interface (`/projects/[id]/chat`)

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Project    Project Name                    [Settings] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┬──────────────────────────────────────────┐   │
│  │ Conversations│           Chat-Bereich                    │   │
│  │              │                                           │   │
│  │ [+ New Chat] │  ┌─────────────────────────────────────┐  │   │
│  │              │  │ 🧑 Implementiere User Auth mit...   │  │   │
│  │ ● Auth Setup │  │                                     │  │   │
│  │   vor 2h     │  │ 🟢 Ich analysiere die Anforderung.  │  │   │
│  │              │  │    Folgende Schritte sind nötig:    │  │   │
│  │ ○ DB Schema  │  │    1. ...                           │  │   │
│  │   vor 1d     │  │    2. ...                           │  │   │
│  │              │  │                                     │  │   │
│  │ ○ API Design │  │ 🟢 Erstelle CODE-Task für Schritt 1 │  │   │
│  │   vor 3d     │  └─────────────────────────────────────┘  │   │
│  │              │                                           │   │
│  │              │  ┌─────────────────────────────────────┐  │   │
│  │              │  │ Message...              [Send]      │  │   │
│  │              │  └─────────────────────────────────────┘  │   │
│  └──────────────┴──────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ▼ Context Files (.ai/)                        [+ Upload] │   │
│  │   ├── spec.md                           [Edit] [Delete]  │   │
│  │   ├── research.md                       [Edit] [Delete]  │   │
│  │   └── decisions.md                      [Edit] [Delete]  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Conversations-Sidebar:**
- Liste aller Conversations (sortiert nach `updated_at`)
- "New Chat" Button zum Starten einer neuen Conversation
- Aktive Conversation hervorgehoben
- Titel anklickbar zum Umbenennen (inline edit)
- Status-Indikator: ● aktiv, ○ archiviert

**Chat-Bereich:**
- Messages chronologisch (älteste oben)
- User-Messages: rechts ausgerichtet oder mit User-Icon
- Green-Messages: links ausgerichtet mit 🟢 Icon
- System-Messages: zentriert, grau (z.B. "Task erstellt")
- Auto-Scroll zu neuester Nachricht
- Realtime-Updates via Supabase Realtime

**Conversation-Titel:**
- Auto-generiert aus erster User-Nachricht (erste ~50 Zeichen)
- Editierbar per Klick (inline oder Modal)

### Context-Files Panel

**Tree View (collapsible):**
- Zeigt alle Dateien im `.ai/` Verzeichnis des Repos
- Collapsible/Expandable
- Nur `.md` und `.txt` Dateien editierbar

**Aktionen pro Datei:**
| Aktion | Verfügbar für | Beschreibung |
|--------|---------------|--------------|
| **Edit** | `.md`, `.txt` | Öffnet ASCII-Editor Modal |
| **Delete** | Alle | Löscht Datei (mit Bestätigung) |
| **Download** | Alle | Lädt Datei herunter |

**Upload:**
- Button "+ Upload" öffnet File-Picker
- Akzeptiert: `.md`, `.txt`, `.json`, `.yaml`, `.yml`
- Ziel-Pfad wählbar: `.ai/context/`, `.ai/instructions/`, etc.
- Nach Upload: Commit ins Repo

**ASCII-Editor Modal:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Edit: spec.md                                            [X]    │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ # Feature Specification                                     │ │
│ │                                                             │ │
│ │ ## Overview                                                 │ │
│ │ This feature implements...                                  │ │
│ │                                                             │ │
│ │ ## Requirements                                             │ │
│ │ - Requirement 1                                             │ │
│ │ - Requirement 2                                             │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                                      [Cancel]  [Save & Commit]  │
└─────────────────────────────────────────────────────────────────┘
```

- Monospace Font (Code-Editor Style)
- Kein Markdown-Rendering (reiner ASCII/Text)
- Hauptanwendungsfall: Paste von externem Content (ChatGPT, Gemini, etc.)
- Save & Commit: Speichert und committed direkt ins Repo

### Git-Integration für Context-Files

**Workflow Upload:**
1. User wählt Datei und Ziel-Pfad
2. API klont Repo (oder verwendet existierenden Clone)
3. Datei wird in `.ai/context/` geschrieben
4. Git Add + Commit + Push
5. UI aktualisiert Tree View

**Workflow Edit:**
1. User öffnet Editor für existierende Datei
2. API liest aktuelle Version aus Repo
3. User editiert und klickt "Save & Commit"
4. API schreibt Datei, Commit, Push
5. UI bestätigt Erfolg

**Workflow Delete:**
1. User klickt Delete (mit Bestätigungs-Dialog)
2. API löscht Datei aus Repo
3. Git Add + Commit + Push
4. UI aktualisiert Tree View

**Commit-Messages:**
- Upload: `docs: add context file {filename}`
- Edit: `docs: update context file {filename}`
- Delete: `docs: remove context file {filename}`

### API-Routen

| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/conversations` | GET | Liste Conversations für Projekt |
| `/api/conversations` | POST | Neue Conversation erstellen |
| `/api/conversations/[id]` | GET | Conversation mit Messages |
| `/api/conversations/[id]` | PATCH | Titel/Status ändern |
| `/api/conversations/[id]` | DELETE | Conversation archivieren |
| `/api/conversations/[id]/messages` | GET | Messages einer Conversation |
| `/api/conversations/[id]/messages` | POST | Neue Message (+ Task erstellen) |
| `/api/projects/[id]/context` | GET | Liste Context-Files aus Repo |
| `/api/projects/[id]/context` | POST | Upload neue Datei |
| `/api/projects/[id]/context/[path]` | GET | Datei-Inhalt lesen |
| `/api/projects/[id]/context/[path]` | PUT | Datei aktualisieren |
| `/api/projects/[id]/context/[path]` | DELETE | Datei löschen |

### UI-Komponenten

| Komponente | Beschreibung |
|------------|--------------|
| `ChatLayout` | Haupt-Layout mit Sidebar + Chat + Context |
| `ConversationList` | Sidebar mit Conversation-Liste |
| `ConversationItem` | Einzelne Conversation in Liste |
| `ChatMessages` | Scrollbare Message-Liste |
| `ChatMessage` | Einzelne Message (User/Green/System) |
| `ChatInput` | Eingabefeld + Send-Button |
| `ContextFilesPanel` | Collapsible Tree View |
| `ContextFileItem` | Einzelne Datei mit Aktionen |
| `FileEditorModal` | ASCII-Editor für .md/.txt |
| `FileUploadDialog` | Upload-Dialog mit Pfad-Auswahl |
| `DeleteConfirmDialog` | Bestätigung für Datei-Löschung |

### Verzeichnisstruktur (neu)

```
services/cockpit/src/
├── app/
│   ├── projects/[id]/
│   │   ├── chat/
│   │   │   └── page.tsx            # Chat-Interface
│   │   └── context/
│   │       └── page.tsx            # Context-Files Standalone (optional)
│   └── api/
│       ├── conversations/
│       │   ├── route.ts            # GET, POST
│       │   └── [id]/
│       │       ├── route.ts        # GET, PATCH, DELETE
│       │       └── messages/
│       │           └── route.ts    # GET, POST
│       └── projects/[id]/
│           └── context/
│               ├── route.ts        # GET (list), POST (upload)
│               └── [...path]/
│                   └── route.ts    # GET, PUT, DELETE
├── components/
│   ├── chat/
│   │   ├── ChatLayout.tsx
│   │   ├── ConversationList.tsx
│   │   ├── ChatMessages.tsx
│   │   ├── ChatMessage.tsx
│   │   └── ChatInput.tsx
│   └── context/
│       ├── ContextFilesPanel.tsx
│       ├── ContextFileItem.tsx
│       ├── FileEditorModal.tsx
│       └── FileUploadDialog.tsx
└── lib/
    └── git-operations.ts           # Git Clone/Commit/Push Helpers
```

### Implementierungs-Reihenfolge

1. **Migration 006:** Conversations + Messages Tabellen
2. **API:** Conversations CRUD + Messages
3. **UI:** ChatLayout + ConversationList + ChatMessages
4. **API:** Context-Files (Git-Integration)
5. **UI:** ContextFilesPanel + FileEditorModal + Upload
6. **Integration:** Task-Erstellung bei neuer Message
7. **Realtime:** Supabase Realtime für neue Messages

### Task-Typ Erweiterung

Neuer Task-Typ in `database.types.ts`:
```typescript
export type TaskType =
  | "CODE"
  | "MERGE"
  | "REVIEW"
  | "FIX"
  | "PR"
  | "VALIDATE"
  | "USER_MESSAGE";  // NEU
```

### Green Agent Prompt-Erweiterung

Bei `USER_MESSAGE` Tasks erhält Green:
```
Du bist der Project Manager (Green Agent) für das Projekt "{project_name}".

Der User hat eine neue Nachricht in Conversation "{conversation_title}" geschrieben.

## Conversation History
{alle_messages_chronologisch}

## Context-Dateien
Die folgenden Dateien sind im .ai/ Verzeichnis verfügbar:
{liste_der_context_files}

Du kannst diese Dateien bei Bedarf mit dem Read-Tool lesen.

## Deine Aufgabe
1. Lies und verstehe die User-Nachricht
2. Antworte hilfreich und präzise
3. Wenn Coding-Arbeit nötig ist, erstelle entsprechende CODE-Tasks
4. Wenn nur eine Antwort nötig ist, antworte und beende den Task

Deine Antwort wird automatisch als Message (role: "green") gespeichert.
```

---

## Steuerung & Kontrolle

### Pause / Resume (Green Agent) - Phase 4

| Aktion | Effekt |
|--------|--------|
| **Pause** | Aktueller Red darf weiterlaufen, aber Green erstellt keine neuen Tasks |
| **Resume** | Green arbeitet normal weiter |

### Kill Job (Notfall) - Phase 4

| Aktion | Effekt |
|--------|--------|
| **Kill Red** | Laufenden Red-Job terminieren |
| **Kill Green** | Laufenden Green-Job terminieren |

**Cleanup nach Kill:**
- Branch löschen
- Task als `killed` markieren

---

## Kommunikation über Git

**Paradigmenwechsel:** Statt alles in den Task-Prompt zu packen, sollen Aufgaben in Markdown-Dateien geschrieben werden.

**Vorteile:**
- Git-Historie für Tracking
- Reproduzierbarkeit
- Lesbarkeit

**Beispiel-Struktur im Projekt-Repo:**
```
.ai/
├── plan.md           # Aktueller Plan (von Green gepflegt)
├── epic.md           # Epic-Beschreibung
├── context/          # Zusätzlicher Kontext
│   └── decisions.md
└── instructions/     # Anweisungen
    └── next-step.md
```

---

## Phasen-Plan

### Phase 1: Basis-Dashboard ✅ Implementiert

- [x] NextAuth v5 Setup (GitHub OAuth)
- [x] Zwei-Stufen-Autorisierung (pending/authorized)
- [x] User-Verwaltung (`/admin/users`)
- [x] Dashboard-Layout mit Projekt-Kacheln
- [x] System-Status Footer (aus DB lesen)
- [x] Dark/Light Theme Toggle
- [x] shadcn/ui Komponenten
- [x] Deep Orange Primary Color + Anthrazit Dark Theme

### Phase 2: Projektansicht ✅ Implementiert

- [x] Task-Historie Ansicht
- [x] Task-Detail mit Log-Visualisierung
- [x] JSONL-Parser und Renderer
- [x] Supabase Realtime für Live-Updates
- [x] Agent-Visualisierung (farbige Ränder in Task-Liste)
- [x] Agent-Banner auf Task-Detail-Seite (Red/Green/Blue)
- [x] Markdown-Rendering für Prompts und Results
- [x] Collapsible Cards für Task Prompt, Result, Execution
- [x] Agent-Utils für Server/Client-Komponenten

### Phase 3: Projektverwaltung & Kommunikation

**Teil 1: Projektverwaltung**
- [x] Projekt hinzufügen (GitHub Repo URL, Name, Default Branch)
- [x] Projekt bearbeiten (Name, Epic, Status, Branches)
- [x] Projekt archivieren (Soft Delete via `deleted` Flag)
- [x] Archivierte Projekte ausblenden (Filter im Dashboard)

**Teil 2: Kommunikation**
- [ ] Chat-Interface pro Projekt (`/projects/[id]/chat`)
- [ ] Conversations-System (Gruppierung von Messages)
- [ ] Context-Files Management (`/projects/[id]/context`)
- [ ] Task-Integration (USER_MESSAGE Task-Typ)

### Phase 4: Steuerung

- [ ] Pause/Resume für Green
- [ ] Kill-Funktion für Jobs
- [ ] Cluster-Monitoring Container

### Phase 5: Blue Integration

- [ ] Blue Agent Kommunikation
- [ ] Strategische Planung
- [ ] Agent-Routing (Green vs Blue)

---

## Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI Components | shadcn/ui |
| Styling | Tailwind CSS v4 + @tailwindcss/typography |
| Auth | NextAuth v5 (Auth.js) mit GitHub Provider |
| Database | Supabase (PostgreSQL + Realtime) |
| Markdown | react-markdown |
| Theming | next-themes (Dark default) |
| Icons | Lucide React |
| Deployment | Vercel |
| Monitoring | Eigener K8s-Container (geplant) |

### Design-System

| Element | Wert |
|---------|------|
| Primary Color | Deep Orange `#ff6d00` |
| Dark Background | Anthrazit `oklch(0.13 0.005 285)` |
| Dark Card | `oklch(0.18 0.005 285)` |
| Light Background | `oklch(0.97 0.002 286)` |
| Default Theme | Dark |

---

## Verzeichnisstruktur

```
services/cockpit/
├── src/
│   ├── app/
│   │   ├── api/auth/[...nextauth]/       # NextAuth API
│   │   ├── api/projects/                 # Projects API Routes
│   │   │   ├── route.ts                  # GET (list), POST (create)
│   │   │   └── [id]/route.ts             # GET, PATCH, DELETE (archive)
│   │   ├── admin/
│   │   │   ├── users/                    # User-Verwaltung
│   │   │   └── projects/                 # Projekt-Verwaltung
│   │   │       ├── page.tsx              # Projektliste
│   │   │       ├── new/page.tsx          # Neues Projekt
│   │   │       └── [id]/edit/page.tsx    # Projekt bearbeiten
│   │   ├── login/                        # Login-Seite
│   │   ├── pending/                      # Warteseite für neue User
│   │   ├── projects/[id]/                # Projekt-Detail mit Task-Historie
│   │   │   └── tasks/[taskId]/           # Task-Detail mit Agent-Banner
│   │   ├── layout.tsx                    # Root Layout + ThemeProvider
│   │   ├── page.tsx                      # Dashboard
│   │   └── globals.css                   # CSS Variables + Theme + Typography
│   ├── components/
│   │   ├── ui/                           # shadcn Komponenten
│   │   ├── Header.tsx
│   │   ├── ProjectCard.tsx
│   │   ├── ProjectForm.tsx               # Shared Form für Create/Edit
│   │   ├── ProjectList.tsx               # Admin-Liste aller Projekte
│   │   ├── ArchiveDialog.tsx             # Bestätigungs-Modal für Archivierung
│   │   ├── SystemStatus.tsx
│   │   ├── TaskCard.tsx                  # Task-Kachel mit Agent-Farbe
│   │   ├── TaskList.tsx                  # Statische Task-Liste
│   │   ├── RealtimeTaskList.tsx          # Task-Liste mit Live-Updates
│   │   ├── LogViewer.tsx                 # JSONL Log + MarkdownContent
│   │   ├── RealtimeLogViewer.tsx         # Log-Viewer mit Live-Updates
│   │   ├── ResultCard.tsx                # Result mit Realtime + Markdown
│   │   ├── CollapsibleCard.tsx           # Ein-/ausklappbare Card
│   │   ├── theme-provider.tsx
│   │   └── theme-toggle.tsx
│   ├── hooks/
│   │   └── useRealtimeTasks.ts           # Supabase Realtime Hooks
│   ├── lib/
│   │   ├── agent-utils.ts                # Agent-Type Erkennung (shared)
│   │   ├── database.types.ts             # TypeScript Types
│   │   ├── jsonl-parser.ts               # JSONL Parser für Claude CLI Output
│   │   ├── supabase.ts                   # Supabase Client
│   │   └── utils.ts                      # shadcn utils
│   ├── auth.ts                           # NextAuth Konfiguration
│   └── proxy.ts                          # Auth Middleware
├── .env.example
├── components.json                       # shadcn Config
├── package.json
└── README.md
```

---

## Lokale Entwicklung

### Voraussetzungen

1. **GitHub OAuth App (Dev)** erstellen:
   - Homepage URL: `http://localhost:3000`
   - Callback URL: `http://localhost:3000/api/auth/callback/github`

2. **Supabase Credentials** aus Dashboard holen

3. **Migration ausführen:** `infrastructure/migrations/004_cockpit_users.sql`

### Setup

```bash
cd services/cockpit
cp .env.example .env.local
# .env.local mit echten Werten füllen
npm install
npm run dev
```

### Umgebungsvariablen

| Variable | Beschreibung |
|----------|--------------|
| `AUTH_SECRET` | NextAuth Secret (`openssl rand -base64 32`) |
| `AUTH_GITHUB_ID` | GitHub OAuth Client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth Client Secret |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (JWT!) |

**Wichtig:** Der `SUPABASE_SERVICE_ROLE_KEY` muss ein JWT sein (beginnt mit `eyJ...`), nicht das kurze Secret!
