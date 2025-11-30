# Database Schema Reference

Supabase/PostgreSQL. REST API: `https://<project>.supabase.co/rest/v1/`

## Tables

### schema_migrations
```
id              SERIAL PK
migration_name  VARCHAR(255) NOT NULL UNIQUE
applied_at      TIMESTAMPTZ DEFAULT NOW()
checksum        VARCHAR(64)
```

### tasks
```
id              UUID PK DEFAULT gen_random_uuid()
addressee       VARCHAR(255) NOT NULL          -- routing key: "project-mgr-{project}" | "worker-{uuid}"
status          VARCHAR(50) DEFAULT 'pending'  -- CHECK: pending|running|completed|failed
prompt          TEXT NOT NULL
repo_url        TEXT
branch          VARCHAR(255)
created_by      VARCHAR(255)
created_at      TIMESTAMPTZ DEFAULT NOW()
started_at      TIMESTAMPTZ
completed_at    TIMESTAMPTZ
result          JSONB                          -- {success:bool, summary:string, pr_url?:string, cost_usd?:number, duration_ms?:number}
worker_pod      VARCHAR(255)
```

**Indices:**
- `idx_tasks_pending`: (addressee, status) WHERE status='pending'
- `idx_tasks_running`: (addressee) WHERE status='running'
- `idx_tasks_status`: (status, created_at)

### task_logs
```
id              UUID PK DEFAULT gen_random_uuid()
task_id         UUID NOT NULL FK->tasks(id) ON DELETE CASCADE
jsonl_content   TEXT NOT NULL
log_size_bytes  INTEGER
created_at      TIMESTAMPTZ DEFAULT NOW()
```

**Indices:**
- `idx_task_logs_task_id`: (task_id)

## Concurrency Model

Same addressee = sequential execution. Different addressees = parallel.
- `project-mgr-{project}` → one project manager per project
- `worker-{uuid}` → parallel workers

## Spawning Engine Queries

```sql
-- Poll pending tasks (one per addressee, oldest first)
SELECT DISTINCT ON (addressee) *
FROM tasks
WHERE status = 'pending'
ORDER BY addressee, created_at ASC;

-- Check if addressee has running task
SELECT EXISTS(SELECT 1 FROM tasks WHERE addressee = $1 AND status = 'running');

-- Claim task (atomic)
UPDATE tasks SET status = 'running', started_at = NOW(), worker_pod = $2
WHERE id = $1 AND status = 'pending'
RETURNING *;

-- Complete task
UPDATE tasks SET status = 'completed', completed_at = NOW(), result = $2
WHERE id = $1;

-- Fail task
UPDATE tasks SET status = 'failed', completed_at = NOW(), result = $2
WHERE id = $1;

-- Insert log
INSERT INTO task_logs (task_id, jsonl_content, log_size_bytes)
VALUES ($1, $2, LENGTH($2));
```

## REST API Headers

```
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_ANON_KEY>
Content-Type: application/json
Prefer: return=representation  (for INSERT/UPDATE to return rows)
```

## REST API Examples

```bash
# Get pending tasks
GET /rest/v1/tasks?status=eq.pending&order=created_at.asc

# Claim task (use service_role key for RLS bypass)
PATCH /rest/v1/tasks?id=eq.<uuid>
Body: {"status":"running","started_at":"2025-01-01T00:00:00Z","worker_pod":"pod-xyz"}

# Insert task
POST /rest/v1/tasks
Body: {"addressee":"worker-abc","prompt":"Do something","repo_url":"https://..."}
```
