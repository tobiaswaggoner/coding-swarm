#!/usr/bin/env node
/**
 * CLI: Create a new task (for project-manager delegation)
 *
 * Creates a WORK task in the database for a developer to execute.
 *
 * Usage:
 *   node dist/create-task.js --prompt "Task description" [options]
 *
 * Options:
 *   --prompt          Task description (required)
 *   --branch          Target branch for the task
 *   --repo-url        Repository URL (uses project default if not set)
 *   --project-id      Project ID (uses env if not set)
 *   --conversation-id Conversation to link this task to
 *   --task-type       Task type (default: WORK)
 *
 * Environment:
 *   SUPABASE_URL  - Database URL (required)
 *   SUPABASE_KEY  - Database key (required)
 *   PROJECT_ID    - Default project ID
 *   REPO_URL      - Default repository URL
 *
 * Output:
 *   JSON with task ID and addressee
 */
export {};
//# sourceMappingURL=create-task.d.ts.map