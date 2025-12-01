-- Migration: 002_engine_lock
-- Description: Singleton lock for Spawning Engine
-- Created: 2025-11-30
--
-- Prevents multiple engine instances from running simultaneously.

CREATE TABLE IF NOT EXISTS engine_lock (
    id              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Only one row allowed
    holder_id       VARCHAR(255),        -- Unique ID of current holder (e.g., hostname + pid)
    acquired_at     TIMESTAMP WITH TIME ZONE,
    last_heartbeat  TIMESTAMP WITH TIME ZONE,

    CONSTRAINT single_row CHECK (id = 1)
);

-- Insert the single row (does nothing if exists)
INSERT INTO engine_lock (id) VALUES (1) ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE engine_lock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON engine_lock;
CREATE POLICY "Allow all for authenticated" ON engine_lock
    FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE engine_lock IS 'Singleton lock ensuring only one Spawning Engine runs at a time';

-- Record migration
INSERT INTO schema_migrations (migration_name, checksum)
VALUES ('002_engine_lock', 'manual-run')
ON CONFLICT (migration_name) DO NOTHING;
