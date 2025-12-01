-- Migration 006: Conversations and Messages for User-Green Communication
-- Phase 3, Part 2: Chat-based communication between User and Green Agent

-- Conversations group messages for a specific topic/dialog
CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      VARCHAR(255) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title           VARCHAR(255),  -- Auto-generated from first message, but editable
    status          VARCHAR(50) DEFAULT 'active',  -- active, archived
    created_by      UUID REFERENCES cockpit_users(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages within a conversation
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            VARCHAR(50) NOT NULL,  -- 'user', 'green', 'blue', 'system'
    content         TEXT NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Task link: Which task was triggered by this message?
    triggers_task_id UUID REFERENCES tasks(id)
);

-- Indexes for performance
CREATE INDEX idx_conversations_project ON conversations(project_id);
CREATE INDEX idx_conversations_status ON conversations(project_id, status);
CREATE INDEX idx_conversations_updated ON conversations(project_id, updated_at DESC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(conversation_id, created_at);

-- Add USER_MESSAGE to task_type enum (if using enum, otherwise just documentation)
-- Note: If task_type is stored as VARCHAR, no migration needed for the type itself
-- The application code will handle the new type

-- Trigger to update conversation.updated_at when a message is added
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_updated_at
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_updated_at();

-- Enable Realtime for messages table (for live chat updates)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
