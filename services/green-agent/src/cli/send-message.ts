#!/usr/bin/env node
/**
 * CLI: Send a message to a conversation
 *
 * Usage:
 *   node dist/cli/send-message.js --conversation-id <id> --role <role> --content <content>
 *
 * Options:
 *   --conversation-id  Conversation UUID (required)
 *   --role             Message role: "green", "blue", "system" (required)
 *   --content          Message content, Markdown supported (required)
 */

import { createClient } from "@supabase/supabase-js";

interface Args {
  conversationId: string;
  role: string;
  content: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Partial<Args> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    switch (key) {
      case "--conversation-id":
        result.conversationId = value;
        break;
      case "--role":
        result.role = value;
        break;
      case "--content":
        result.content = value;
        break;
    }
  }

  if (!result.conversationId || !result.role || !result.content) {
    console.error(
      "Error: --conversation-id, --role, and --content are required"
    );
    process.exit(1);
  }

  return result as Args;
}

async function main() {
  const args = parseArgs();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Error: SUPABASE_URL and SUPABASE_KEY are required");
    process.exit(1);
  }

  const client = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await client
    .from("messages")
    .insert({
      conversation_id: args.conversationId,
      role: args.role,
      content: args.content,
    })
    .select()
    .single();

  if (error) {
    console.error(`Error sending message: ${error.message}`);
    process.exit(1);
  }

  console.log(`Message sent: ${data.id}`);
  console.log(`Role: ${args.role}`);
}

main().catch((err) => {
  console.error(`Fatal error: ${err}`);
  process.exit(1);
});
