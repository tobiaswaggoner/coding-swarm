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

## Steuerung & Kontrolle

### Pause / Resume (Green Agent) - Phase 3

| Aktion | Effekt |
|--------|--------|
| **Pause** | Aktueller Red darf weiterlaufen, aber Green erstellt keine neuen Tasks |
| **Resume** | Green arbeitet normal weiter |

### Kill Job (Notfall) - Phase 3

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

### Phase 3: Steuerung

- [ ] Pause/Resume für Green
- [ ] Kill-Funktion für Jobs
- [ ] Cluster-Monitoring Container

### Phase 4: Projektverwaltung & Kommunikation

- [ ] Projekt hinzufügen (GitHub Repo URL, Name, Default Branch)
- [ ] Projekt bearbeiten (Epic, Status, Branches)
- [ ] Projekt archivieren/löschen
- [ ] Anweisungs-Interface (Green)
- [ ] Markdown-basierte Kommunikation
- [ ] LLM-Summary Service

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
│   │   ├── admin/users/                  # User-Verwaltung
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
