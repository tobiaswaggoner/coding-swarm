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

import { createDatabase } from "./db/supabase.js";

interface Args {
  content?: string;
  conversationId?: string;
  role?: string;
}

function parseArgs(): Args {
  const args: Args = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case "--content":
      case "-c":
        args.content = next;
        i++;
        break;
      case "--conversation-id":
        args.conversationId = next;
        i++;
        break;
      case "--role":
      case "-r":
        args.role = next;
        i++;
        break;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs();

  // Validate required args
  if (!args.content) {
    console.error("Error: --content is required");
    console.error("Usage: node send-message.js --content 'Message text'");
    process.exit(1);
  }

  // Resolve conversation ID
  const conversationId = args.conversationId || process.env.CONVERSATION_ID;
  if (!conversationId) {
    console.error("Error: --conversation-id is required (or set CONVERSATION_ID env)");
    process.exit(1);
  }

  // Create database client
  const db = createDatabase();
  if (!db) {
    console.error("Error: SUPABASE_URL and SUPABASE_KEY are required");
    process.exit(1);
  }

  const role = args.role || "green";

  try {
    const message = await db.createMessage({
      conversation_id: conversationId,
      role,
      content: args.content,
    });

    // Output result
    console.log(JSON.stringify({
      success: true,
      messageId: message.id,
      conversationId: message.conversation_id,
      role: message.role,
    }, null, 2));

  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, null, 2));
    process.exit(1);
  }
}

main();
