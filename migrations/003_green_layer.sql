-- Migration: 003_green_layer
-- Description: Schema extensions for Green Layer (Project Manager)
-- Created: 2025-11-30
--
-- Adds:
-- 1. project_id, task_type, triggered_by_task_id columns to tasks table
-- 2. projects table for project management
--
-- IDEMPOTENCY: All statements use IF NOT EXISTS / IF EXISTS.
--              Safe to run multiple times.

-- =============================================================================
-- EXTEND TASKS TABLE
-- Add columns for project tracking and task typing
-- =============================================================================

-- Add project_id column (nullable for backward compatibility)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'project_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN project_id VARCHAR(255);
    END IF;
END $$;

-- Add task_type column (CODE, MERGE, REVIEW, FIX, PR, VALIDATE)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'task_type'
    ) THEN
        ALTER TABLE tasks ADD COLUMN task_type VARCHAR(50);
    END IF;
END $$;

-- Add triggered_by_task_id column (references the task that triggered this one)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'triggered_by_task_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN triggered_by_task_id UUID REFERENCES tasks(id);
    END IF;
END $$;

-- Index for project-based queries
CREATE INDEX IF NOT EXISTS idx_tasks_project
    ON tasks(project_id);

-- Index for project + status queries (finding tasks by project)
CREATE INDEX IF NOT EXISTS idx_tasks_project_status
    ON tasks(project_id, status);

-- Index for pending+running check per addressee (for idempotency)
CREATE INDEX IF NOT EXISTS idx_tasks_pending_running
    ON tasks(addressee, status)
    WHERE status IN ('pending', 'running');

-- =============================================================================
-- PROJECTS TABLE
-- Tracks project state, configuration, and statistics
-- =============================================================================

CREATE TABLE IF NOT EXISTS projects (
    -- Identifikation
    id                  VARCHAR(255) PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,

    -- Repository configuration
    repo_url            TEXT NOT NULL,
    default_branch      VARCHAR(255) DEFAULT 'main',
    integration_branch  VARCHAR(255),  -- e.g., feature/new-snake-game

    -- Project lifecycle status
    -- active: Project is being worked on
    -- paused: Temporarily stopped (e.g., waiting for manual intervention)
    -- awaiting_review: PR created, waiting for user review
    -- completed: All work done, PR merged
    -- failed: Unrecoverable error
    status              VARCHAR(50) DEFAULT 'active'
                        CHECK (status IN ('active', 'paused', 'awaiting_review', 'completed', 'failed')),

    -- Current epic being worked on
    current_epic        TEXT,

    -- Timestamps
    last_activity       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by          VARCHAR(255),

    -- Statistics (for monitoring/UI)
    total_tasks         INTEGER DEFAULT 0,
    completed_tasks     INTEGER DEFAULT 0,
    failed_tasks        INTEGER DEFAULT 0,

    -- PR information (when status = 'awaiting_review')
    pr_url              TEXT,
    pr_number           INTEGER
);

-- Index for finding active projects (for watchdog)
CREATE INDEX IF NOT EXISTS idx_projects_active
    ON projects(status, last_activity)
    WHERE status = 'active';

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_projects_status
    ON projects(status);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON projects;
CREATE POLICY "Allow all for authenticated" ON projects
    FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE projects IS 'Project tracking for Green Layer (Project Manager)';
COMMENT ON COLUMN projects.id IS 'Unique project identifier (used in addressee: project-mgr-{id})';
COMMENT ON COLUMN projects.integration_branch IS 'Branch where step branches are merged into';
COMMENT ON COLUMN projects.status IS 'Lifecycle: active -> awaiting_review -> completed (or paused/failed)';
COMMENT ON COLUMN projects.current_epic IS 'Description of the current epic being implemented';

COMMENT ON COLUMN tasks.project_id IS 'Reference to project this task belongs to (nullable for standalone tasks)';
COMMENT ON COLUMN tasks.task_type IS 'Task type: CODE, MERGE, REVIEW, FIX, PR, VALIDATE';
COMMENT ON COLUMN tasks.triggered_by_task_id IS 'Task that triggered this one (for tracing)';

-- =============================================================================
-- RECORD THIS MIGRATION
-- =============================================================================

INSERT INTO schema_migrations (migration_name, checksum)
VALUES ('003_green_layer', 'manual-run')
ON CONFLICT (migration_name) DO NOTHING;
