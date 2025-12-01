#!/usr/bin/env node
/**
 * CLI: Pause a project (e.g., when waiting for user clarification)
 *
 * Usage:
 *   node dist/cli/pause-project.js --project-id <id>
 *
 * Options:
 *   --project-id  Project ID to pause (required)
 */

import { createClient } from "@supabase/supabase-js";

interface Args {
  projectId: string;
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
    }
  }

  if (!result.projectId) {
    console.error("Error: --project-id is required");
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

  const { error } = await client
    .from("projects")
    .update({
      status: "paused",
      last_activity: new Date().toISOString(),
    })
    .eq("id", args.projectId);

  if (error) {
    console.error(`Error pausing project: ${error.message}`);
    process.exit(1);
  }

  console.log(`Project paused: ${args.projectId}`);
}

main().catch((err) => {
  console.error(`Fatal error: ${err}`);
  process.exit(1);
});
