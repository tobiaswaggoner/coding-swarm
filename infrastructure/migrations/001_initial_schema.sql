-- Migration: 001_initial_schema
-- Description: Initial schema for Autonomous Coding Swarm
-- Created: 2025-11-30
--
-- IDEMPOTENCY: All statements use IF NOT EXISTS / IF EXISTS.
--              Safe to run multiple times.

-- =============================================================================
-- SCHEMA MIGRATIONS TABLE
-- Tracks which migrations have been applied.
-- This table is created first as it's needed for tracking.
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    id              SERIAL PRIMARY KEY,
    migration_name  VARCHAR(255) NOT NULL UNIQUE,
    applied_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checksum        VARCHAR(64)  -- Optional: SHA256 of migration file for integrity
);

COMMENT ON TABLE schema_migrations IS 'Tracks applied database migrations for idempotency';

-- =============================================================================
-- TASKS TABLE
-- Core table for task management. Each row represents a single task to be
-- executed by an agent (Red Worker or Green Project Manager).
-- =============================================================================

CREATE TABLE IF NOT EXISTS tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Routing: Determines which agent processes this task
    -- Format: "project-mgr-{project}" or "worker-{uuid}"
    -- Same addressee = sequential execution, different = parallel
    addressee       VARCHAR(255) NOT NULL,

    -- Lifecycle status
    status          VARCHAR(50) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'completed', 'failed')),

    -- Task definition
    prompt          TEXT NOT NULL,
    repo_url        TEXT,
    branch          VARCHAR(255),

    -- Audit fields
    created_by      VARCHAR(255),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at      TIMESTAMP WITH TIME ZONE,
    completed_at    TIMESTAMP WITH TIME ZONE,

    -- Result from agent execution
    -- Schema: {success: bool, summary: string, pr_url?: string, cost_usd?: number, duration_ms?: number}
    result          JSONB,

    -- K8s tracking
    worker_pod      VARCHAR(255)
);

-- Index for Spawning Engine poll query: find pending tasks per addressee
CREATE INDEX IF NOT EXISTS idx_tasks_pending
    ON tasks(addressee, status)
    WHERE status = 'pending';

-- Index for concurrency check: is there already a running task for this addressee?
CREATE INDEX IF NOT EXISTS idx_tasks_running
    ON tasks(addressee)
    WHERE status = 'running';

-- Index for status-based queries (monitoring, cleanup)
CREATE INDEX IF NOT EXISTS idx_tasks_status
    ON tasks(status, created_at);

-- =============================================================================
-- TASK_LOGS TABLE
-- Stores full JSONL output from Claude CLI for debugging and analysis.
-- Separate table to keep tasks table lean for polling.
-- =============================================================================

CREATE TABLE IF NOT EXISTS task_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- Full JSONL content from Claude CLI stream-json output
    jsonl_content   TEXT NOT NULL,

    -- Metadata
    log_size_bytes  INTEGER,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for looking up logs by task
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id
    ON task_logs(task_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Enable RLS but allow all operations. service_role key bypasses RLS anyway.
-- =============================================================================

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;

-- Policies (DROP first for idempotency, then CREATE)
DROP POLICY IF EXISTS "Allow all for authenticated" ON tasks;
CREATE POLICY "Allow all for authenticated" ON tasks
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON task_logs;
CREATE POLICY "Allow all for authenticated" ON task_logs
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON schema_migrations;
CREATE POLICY "Allow all for authenticated" ON schema_migrations
    FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE tasks IS 'Task queue for Autonomous Coding Swarm agents';
COMMENT ON COLUMN tasks.addressee IS 'Routing key: project-mgr-{project} or worker-{uuid}. Same addressee = sequential.';
COMMENT ON COLUMN tasks.status IS 'Lifecycle: pending -> running -> completed|failed';
COMMENT ON COLUMN tasks.result IS 'JSON: {success, summary, pr_url?, cost_usd?, duration_ms?}';

COMMENT ON TABLE task_logs IS 'Full JSONL output from Claude CLI for debugging';

-- =============================================================================
-- RECORD THIS MIGRATION
-- ON CONFLICT DO NOTHING makes this idempotent
-- =============================================================================

INSERT INTO schema_migrations (migration_name, checksum)
VALUES ('001_initial_schema', 'manual-run')
ON CONFLICT (migration_name) DO NOTHING;
