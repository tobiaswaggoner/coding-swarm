-- Migration: 005_projects_soft_delete
-- Description: Add soft delete support for projects
-- Created: 2025-12-01
--
-- Adds:
-- 1. deleted column (boolean flag for soft delete)
-- 2. deleted_at timestamp
-- 3. deleted_by reference to user who deleted
--
-- IDEMPOTENCY: All statements use IF NOT EXISTS / IF EXISTS.
--              Safe to run multiple times.

-- =============================================================================
-- ADD SOFT DELETE COLUMNS TO PROJECTS TABLE
-- =============================================================================

-- Add deleted flag (default false)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'deleted'
    ) THEN
        ALTER TABLE projects ADD COLUMN deleted BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add deleted_at timestamp
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add deleted_by reference (who archived the project)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'deleted_by'
    ) THEN
        ALTER TABLE projects ADD COLUMN deleted_by UUID REFERENCES cockpit_users(id);
    END IF;
END $$;

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Index for filtering non-deleted projects (most common query)
CREATE INDEX IF NOT EXISTS idx_projects_not_deleted
    ON projects(deleted)
    WHERE deleted = FALSE;

-- Index for active non-deleted projects
DROP INDEX IF EXISTS idx_projects_active;
CREATE INDEX IF NOT EXISTS idx_projects_active
    ON projects(status, last_activity)
    WHERE status = 'active' AND deleted = FALSE;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN projects.deleted IS 'Soft delete flag - archived projects are hidden from UI';
COMMENT ON COLUMN projects.deleted_at IS 'Timestamp when project was archived';
COMMENT ON COLUMN projects.deleted_by IS 'User who archived the project';

-- =============================================================================
-- RECORD THIS MIGRATION
-- =============================================================================

INSERT INTO schema_migrations (migration_name, checksum)
VALUES ('005_projects_soft_delete', 'manual-run')
ON CONFLICT (migration_name) DO NOTHING;
