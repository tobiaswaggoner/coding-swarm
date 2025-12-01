-- Migration 008: Add conversation_id to tasks table
-- Required for Green Agent to respond to user messages in the correct conversation
--
-- IDEMPOTENCY: Uses DO block with IF NOT EXISTS check

-- Add conversation_id column to tasks table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'conversation_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN conversation_id UUID REFERENCES conversations(id);
    END IF;
END $$;

-- Index for finding tasks by conversation
CREATE INDEX IF NOT EXISTS idx_tasks_conversation
    ON tasks(conversation_id)
    WHERE conversation_id IS NOT NULL;

-- Comment
COMMENT ON COLUMN tasks.conversation_id IS 'Reference to conversation for USER_MESSAGE tasks (Green needs this to respond in the correct thread)';

-- Record migration
INSERT INTO schema_migrations (migration_name, checksum)
VALUES ('008_tasks_conversation_id', 'manual-run')
ON CONFLICT (migration_name) DO NOTHING;
