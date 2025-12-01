-- Migration: 004_cockpit_users
-- Description: User management for Cockpit with two-stage authorization
-- Created: 2025-12-01
--
-- Users can sign in via GitHub OAuth but need to be authorized
-- before they can access the dashboard.
--
-- IDEMPOTENCY: All statements use IF NOT EXISTS / IF EXISTS.
--              Safe to run multiple times.

-- =============================================================================
-- COCKPIT_USERS TABLE
-- Tracks authorized users for the Cockpit UI
-- =============================================================================

CREATE TABLE IF NOT EXISTS cockpit_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- GitHub identity
    github_id       VARCHAR(255) UNIQUE NOT NULL,
    github_username VARCHAR(255),
    email           VARCHAR(255),
    name            VARCHAR(255),
    avatar_url      TEXT,

    -- Authorization status
    -- pending: User has signed in but not yet authorized
    -- authorized: User is allowed to access the dashboard
    -- blocked: User is explicitly blocked
    status          VARCHAR(50) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'authorized', 'blocked')),

    -- Who authorized this user (null for seed users)
    authorized_by   UUID REFERENCES cockpit_users(id),
    authorized_at   TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for looking up users by GitHub ID (used during auth)
CREATE INDEX IF NOT EXISTS idx_cockpit_users_github_id
    ON cockpit_users(github_id);

-- Index for finding pending users (for admin UI)
CREATE INDEX IF NOT EXISTS idx_cockpit_users_pending
    ON cockpit_users(status)
    WHERE status = 'pending';

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE cockpit_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON cockpit_users;
CREATE POLICY "Allow all for authenticated" ON cockpit_users
    FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- SEED AUTHORIZED USERS
-- These users are automatically authorized (initial admins)
-- =============================================================================

-- Note: These will be inserted on first login via the application
-- The application checks for these emails and auto-authorizes them

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE cockpit_users IS 'User management for Cockpit UI with two-stage authorization';
COMMENT ON COLUMN cockpit_users.github_id IS 'GitHub user ID (stable identifier)';
COMMENT ON COLUMN cockpit_users.status IS 'pending = awaiting authorization, authorized = full access, blocked = denied';
COMMENT ON COLUMN cockpit_users.authorized_by IS 'Reference to the user who authorized this user';

-- =============================================================================
-- RECORD THIS MIGRATION
-- =============================================================================

INSERT INTO schema_migrations (migration_name, checksum)
VALUES ('004_cockpit_users', 'manual-run')
ON CONFLICT (migration_name) DO NOTHING;
