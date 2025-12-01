#!/usr/bin/env node
/**
 * CLI: Send a message to a conversation
 *
 * Adds a message to the conversation for user communication.
 *
 * Usage:
 *   node dist/send-message.js --content "Message text" [options]
 *
 * Options:
 *   --content         Message content (required)
 *   --conversation-id Conversation ID (uses env if not set)
 *   --role            Sender role: green, blue, system (default: green)
 *
 * Environment:
 *   SUPABASE_URL    - Database URL (required)
 *   SUPABASE_KEY    - Database key (required)
 *   CONVERSATION_ID - Default conversation ID
 *
 * Output:
 *   JSON with message ID and success status
 */
export {};
//# sourceMappingURL=send-message.d.ts.map