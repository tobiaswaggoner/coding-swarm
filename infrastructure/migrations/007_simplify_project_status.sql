-- Migration: 007_simplify_project_status
-- Description: Simplify project status to only 'active' and 'paused'
-- Created: 2025-12-01
--
-- Rationale:
-- - 'completed' makes no sense - projects are never "done", there's always follow-ups
-- - 'failed' makes no sense - a task can fail, not the whole project
-- - 'awaiting_review' is redundant - if a PR is open, system waits automatically
--
-- The pause logic belongs in the Spawning Engine, not in agent logic.
-- Only the user should toggle between 'active' and 'paused'.
--
-- IDEMPOTENCY: All statements use IF NOT EXISTS / IF EXISTS.
--              Safe to run multiple times.

-- =============================================================================
-- MIGRATE EXISTING STATUS VALUES
-- Map all non-paused statuses to 'active'
-- =============================================================================

UPDATE projects
SET status = 'active'
WHERE status NOT IN ('active', 'paused');

-- =============================================================================
-- UPDATE CHECK CONSTRAINT
-- =============================================================================

-- Drop the old constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- Add new simplified constraint
ALTER TABLE projects ADD CONSTRAINT projects_status_check
    CHECK (status IN ('active', 'paused'));

-- =============================================================================
-- UPDATE INDEX
-- The idx_projects_active index was filtering on status = 'active'
-- This is still valid but let's recreate it for clarity
-- =============================================================================

DROP INDEX IF EXISTS idx_projects_active;
CREATE INDEX idx_projects_active
    ON projects(status, last_activity)
    WHERE status = 'active';

-- =============================================================================
-- UPDATE COMMENTS
-- =============================================================================

COMMENT ON COLUMN projects.status IS 'Lifecycle: active (being worked on) or paused (user stopped processing)';

-- =============================================================================
-- RECORD THIS MIGRATION
-- =============================================================================

INSERT INTO schema_migrations (migration_name, checksum)
VALUES ('007_simplify_project_status', 'manual-run')
ON CONFLICT (migration_name) DO NOTHING;
