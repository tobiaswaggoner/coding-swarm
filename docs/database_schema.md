# Database Schema Reference

Supabase/PostgreSQL. REST API: `https://<project>.supabase.co/rest/v1/`

## Tabellen-Übersicht

| Tabelle | Beschreibung |
|---------|--------------|
| `schema_migrations` | Migration-Tracking |
| `tasks` | Task-Queue für Red/Green Agents |
| `task_logs` | JSONL-Logs für Diagnose |
| `projects` | Projekt-Metadaten und Statistiken |
| `engine_lock` | Singleton-Lock für Spawning Engine |
| `cockpit_users` | GitHub OAuth User-Verwaltung |
| `conversations` | Chat-Konversationen pro Projekt |
| `messages` | Chat-Nachrichten |

---

## schema_migrations

Migration-Tracking (intern).

```sql
id              SERIAL PK
migration_name  VARCHAR(255) NOT NULL UNIQUE
applied_at      TIMESTAMPTZ DEFAULT NOW()
checksum        VARCHAR(64)
```

---

## tasks

Core Task-Queue für alle Agents.

```sql
id                   UUID PK DEFAULT gen_random_uuid()
addressee            VARCHAR(255) NOT NULL      -- Routing: "project-mgr-{id}" | "worker-{uuid}"
status               VARCHAR(50) DEFAULT 'pending'
                     CHECK (status IN ('pending', 'running', 'completed', 'failed'))
prompt               TEXT NOT NULL
repo_url             TEXT
branch               VARCHAR(255)
created_by           VARCHAR(255)
created_at           TIMESTAMPTZ DEFAULT NOW()
started_at           TIMESTAMPTZ
completed_at         TIMESTAMPTZ
result               JSONB                      -- Siehe Result-Schema unten
worker_pod           VARCHAR(255)
project_id           VARCHAR(255)               -- FK zu projects.id (nullable)
task_type            VARCHAR(50)                -- CODE|MERGE|REVIEW|FIX|PR|VALIDATE|WORK|USER_MESSAGE
triggered_by_task_id UUID FK->tasks(id)         -- Task-Chain Tracing
conversation_id      UUID FK->conversations(id) -- Für USER_MESSAGE Tasks
```

**Result JSONB Schema:**
```json
{
  "success": true,
  "summary": "Task completed successfully",
  "pr_url": "https://github.com/...",
  "pr_number": 42,
  "branch": "feature/step-1-xxx",
  "conflicts": false,
  "decision": "APPROVE",
  "issues": ["..."],
  "cost_usd": 0.15,
  "duration_ms": 45000
}
```

**Indices:**
```sql
idx_tasks_pending          ON (addressee, status) WHERE status = 'pending'
idx_tasks_running          ON (addressee) WHERE status = 'running'
idx_tasks_status           ON (status, created_at)
idx_tasks_project          ON (project_id)
idx_tasks_project_status   ON (project_id, status)
idx_tasks_pending_running  ON (addressee, status) WHERE status IN ('pending', 'running')
idx_tasks_conversation     ON (conversation_id) WHERE conversation_id IS NOT NULL
```

---

## task_logs

Vollständige JSONL-Logs von Claude CLI.

```sql
id              UUID PK DEFAULT gen_random_uuid()
task_id         UUID NOT NULL FK->tasks(id) ON DELETE CASCADE
jsonl_content   TEXT NOT NULL
log_size_bytes  INTEGER
created_at      TIMESTAMPTZ DEFAULT NOW()
```

**Indices:**
```sql
idx_task_logs_task_id  ON (task_id)
```

---

## projects

Projekt-Tracking für Green Layer.

```sql
id                  VARCHAR(255) PK            -- z.B. "snake-game"
name                VARCHAR(255) NOT NULL
repo_url            TEXT NOT NULL
default_branch      VARCHAR(255) DEFAULT 'main'
integration_branch  VARCHAR(255)               -- z.B. "feature/snake-game"
status              VARCHAR(50) DEFAULT 'active'
                    CHECK (status IN ('active', 'paused'))
current_epic        TEXT
last_activity       TIMESTAMPTZ DEFAULT NOW()
created_at          TIMESTAMPTZ DEFAULT NOW()
created_by          VARCHAR(255)
total_tasks         INTEGER DEFAULT 0
completed_tasks     INTEGER DEFAULT 0
failed_tasks        INTEGER DEFAULT 0
pr_url              TEXT
pr_number           INTEGER
deleted             BOOLEAN DEFAULT FALSE
deleted_at          TIMESTAMPTZ
deleted_by          UUID FK->cockpit_users(id)
```

**Indices:**
```sql
idx_projects_status       ON (status)
idx_projects_active       ON (status, last_activity) WHERE status = 'active' AND deleted = FALSE
idx_projects_not_deleted  ON (deleted) WHERE deleted = FALSE
```

---

## engine_lock

Singleton-Lock für Spawning Engine (nur 1 Zeile).

```sql
id              INTEGER PK DEFAULT 1 CHECK (id = 1)
holder_id       VARCHAR(255)           -- "hostname-randomhex"
acquired_at     TIMESTAMPTZ
last_heartbeat  TIMESTAMPTZ
```

**Constraint:** `CHECK (id = 1)` - Garantiert Singleton

**Lock-Logik:**
- Heartbeat alle 10 Sekunden
- Lock gilt als abgelaufen nach 30 Sekunden ohne Heartbeat
- Neue Instanz kann Lock übernehmen wenn `holder_id IS NULL` oder Heartbeat expired

---

## cockpit_users

GitHub OAuth User-Verwaltung mit Zwei-Stufen-Autorisierung.

```sql
id              UUID PK DEFAULT gen_random_uuid()
github_id       VARCHAR(255) UNIQUE NOT NULL
github_username VARCHAR(255)
email           VARCHAR(255)
name            VARCHAR(255)
avatar_url      TEXT
status          VARCHAR(50) DEFAULT 'pending'
                CHECK (status IN ('pending', 'authorized', 'blocked'))
authorized_by   UUID FK->cockpit_users(id)     -- Self-referential
authorized_at   TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT NOW()
last_login      TIMESTAMPTZ DEFAULT NOW()
```

**Status-Flow:**
1. `pending` - User hat sich eingeloggt, wartet auf Freigabe
2. `authorized` - User darf Dashboard nutzen
3. `blocked` - User explizit gesperrt

**Seed Users** (auto-authorized):
- `tobias.waggoner@gmail.com`
- `tobias.waggoner@netzalist.de`

**Indices:**
```sql
idx_cockpit_users_github_id  ON (github_id)
idx_cockpit_users_pending    ON (status) WHERE status = 'pending'
```

---

## conversations

Chat-Konversationen pro Projekt.

```sql
id              UUID PK DEFAULT gen_random_uuid()
project_id      VARCHAR(255) NOT NULL FK->projects(id) ON DELETE CASCADE
title           VARCHAR(255)           -- Auto-generiert aus erster Nachricht
status          VARCHAR(50) DEFAULT 'active'  -- 'active' | 'archived'
created_by      UUID FK->cockpit_users(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()    -- Auto-update via Trigger
```

**Indices:**
```sql
idx_conversations_project  ON (project_id)
idx_conversations_status   ON (project_id, status)
idx_conversations_updated  ON (project_id, updated_at DESC)
```

**Trigger:** Auto-Update von `updated_at` bei neuen Nachrichten

**Realtime:** Published to `supabase_realtime` für Live-Updates

---

## messages

Chat-Nachrichten.

```sql
id               UUID PK DEFAULT gen_random_uuid()
conversation_id  UUID NOT NULL FK->conversations(id) ON DELETE CASCADE
role             VARCHAR(50) NOT NULL   -- 'user' | 'green' | 'blue' | 'system'
content          TEXT NOT NULL
created_at       TIMESTAMPTZ DEFAULT NOW()
triggers_task_id UUID FK->tasks(id)     -- Welchen Task diese Nachricht ausgelöst hat
```

**Rollen:**
- `user` - Nachricht vom Cockpit-User
- `green` - Antwort vom Green Agent
- `blue` - Antwort vom Blue Agent (zukünftig)
- `system` - System-generierte Nachricht

**Indices:**
```sql
idx_messages_conversation  ON (conversation_id)
idx_messages_created       ON (conversation_id, created_at)
```

**Realtime:** Published to `supabase_realtime` für Live-Updates

---

## Concurrency Model

**Addressee-basierte Sequenzierung:**
- Gleicher Addressee = sequentielle Ausführung
- Verschiedene Addressees = parallele Ausführung (bis MAX_PARALLEL_JOBS)

**Addressee-Formate:**
| Format | Agent | Verhalten |
|--------|-------|-----------|
| `project-mgr-{project-id}` | Green | Sequentiell pro Projekt |
| `worker-{uuid}` | Red | Parallel |

**Beispiel:** 3 Projekte können gleichzeitig je 1 Green + mehrere Red haben.

---

## Spawning Engine Queries

```sql
-- Poll pending tasks (one per addressee, oldest first)
-- Note: Supabase doesn't support DISTINCT ON, deduplication in code
SELECT * FROM tasks
WHERE status = 'pending'
ORDER BY addressee, created_at ASC;

-- Check if addressee has running task
SELECT EXISTS(
  SELECT 1 FROM tasks
  WHERE addressee = $1 AND status = 'running'
);

-- Check if addressee has pending or running task (idempotency)
SELECT EXISTS(
  SELECT 1 FROM tasks
  WHERE addressee = $1 AND status IN ('pending', 'running')
);

-- Claim task (atomic via conditional update)
UPDATE tasks
SET status = 'running', started_at = NOW(), worker_pod = $2
WHERE id = $1 AND status = 'pending'
RETURNING *;

-- Complete task
UPDATE tasks
SET status = 'completed', completed_at = NOW(), result = $2
WHERE id = $1 AND status = 'running';

-- Fail task
UPDATE tasks
SET status = 'failed', completed_at = NOW(), result = $2
WHERE id = $1 AND status = 'running';

-- Save logs
INSERT INTO task_logs (task_id, jsonl_content, log_size_bytes)
VALUES ($1, $2, LENGTH($2));

-- Increment project stats
UPDATE projects
SET total_tasks = total_tasks + 1,
    completed_tasks = completed_tasks + CASE WHEN $2 THEN 1 ELSE 0 END,
    failed_tasks = failed_tasks + CASE WHEN $2 THEN 0 ELSE 1 END,
    last_activity = NOW()
WHERE id = $1;
```

---

## Cockpit Queries

```sql
-- Get all non-deleted projects
SELECT * FROM projects WHERE deleted = FALSE ORDER BY last_activity DESC;

-- Get project with task counts
SELECT p.*,
  (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'running') as running_count
FROM projects p WHERE p.id = $1;

-- Get tasks for project (grouped by status)
SELECT * FROM tasks
WHERE project_id = $1
ORDER BY
  CASE status
    WHEN 'running' THEN 1
    WHEN 'pending' THEN 2
    ELSE 3
  END,
  created_at DESC;

-- Get conversations for project
SELECT * FROM conversations
WHERE project_id = $1 AND status = 'active'
ORDER BY updated_at DESC;

-- Get messages for conversation
SELECT * FROM messages
WHERE conversation_id = $1
ORDER BY created_at ASC;

-- Create user message and trigger task
INSERT INTO messages (conversation_id, role, content, triggers_task_id)
VALUES ($1, 'user', $2, $3);

INSERT INTO tasks (addressee, prompt, project_id, task_type, conversation_id)
VALUES ('project-mgr-' || $project_id, $prompt, $project_id, 'USER_MESSAGE', $conversation_id);
```

---

## REST API Headers

```
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_ANON_KEY>
Content-Type: application/json
Prefer: return=representation  (for INSERT/UPDATE to return rows)
```

---

## Migration History

| Migration | Änderungen |
|-----------|------------|
| 001 | schema_migrations, tasks, task_logs |
| 002 | engine_lock (Singleton) |
| 003 | tasks erweitert (project_id, task_type, triggered_by_task_id), projects |
| 004 | cockpit_users (GitHub OAuth) |
| 005 | Soft-Delete für projects (deleted, deleted_at, deleted_by) |
| 006 | conversations, messages, Trigger |
| 007 | Project status vereinfacht: nur active/paused |
| 008 | tasks.conversation_id (für USER_MESSAGE) |

---

## Design-Prinzipien

1. **Row Level Security (RLS):** Alle Tabellen haben RLS mit permissiven Policies
2. **Idempotente Migrations:** `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`
3. **Timestamps:** Alle mit `TIMESTAMP WITH TIME ZONE`
4. **UUIDs:** `gen_random_uuid()` für verteilte Eindeutigkeit
5. **Cascading Deletes:** FK mit `ON DELETE CASCADE` wo sinnvoll
6. **Status als VARCHAR:** CHECK constraints statt PostgreSQL ENUM
7. **Realtime:** conversations + messages für Live-Chat-Updates
8. **Soft-Delete:** Projects werden archiviert, nicht gelöscht
