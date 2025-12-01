#!/usr/bin/env node
/**
 * CLI: Create a WORK task for a Red Agent
 *
 * Usage:
 *   node dist/cli/create-task.js --project-id <id> --prompt <prompt> --repo-url <url> [options]
 *
 * Options:
 *   --project-id       Project ID (required)
 *   --prompt           Task description (required)
 *   --repo-url         Repository URL (required)
 *   --branch           Target branch (optional)
 *   --conversation-id  Link to conversation (optional)
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

interface Args {
  projectId: string;
  prompt: string;
  repoUrl: string;
  branch?: string;
  conversationId?: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Partial<Args> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    switch (key) {
      case "--project-id":
        result.projectId = value;
        break;
      case "--prompt":
        result.prompt = value;
        break;
      case "--repo-url":
        result.repoUrl = value;
        break;
      case "--branch":
        result.branch = value;
        break;
      case "--conversation-id":
        result.conversationId = value;
        break;
    }
  }

  if (!result.projectId || !result.prompt || !result.repoUrl) {
    console.error("Error: --project-id, --prompt, and --repo-url are required");
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

  // Generate unique addressee for this worker task
  const addressee = `worker-${randomUUID()}`;

  const taskData: Record<string, unknown> = {
    addressee,
    status: "pending",
    prompt: args.prompt,
    repo_url: args.repoUrl,
    branch: args.branch || null,
    project_id: args.projectId,
    task_type: "WORK",
    created_by: "green-agent",
  };

  // Add conversation_id if provided
  if (args.conversationId) {
    taskData.conversation_id = args.conversationId;
  }

  const { data, error } = await client
    .from("tasks")
    .insert(taskData)
    .select()
    .single();

  if (error) {
    console.error(`Error creating task: ${error.message}`);
    process.exit(1);
  }

  console.log(`Task created: ${data.id}`);
  console.log(`Addressee: ${addressee}`);
  console.log(`Type: WORK`);
  if (args.branch) {
    console.log(`Branch: ${args.branch}`);
  }
}

main().catch((err) => {
  console.error(`Fatal error: ${err}`);
  process.exit(1);
});
