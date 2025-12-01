#!/usr/bin/env node
/**
 * CLI: Pause a project
 *
 * Sets the project status to "paused" to halt automatic task processing.
 * Used when clarification from the user is needed.
 *
 * Usage:
 *   node dist/pause-project.js [--project-id <id>]
 *
 * Options:
 *   --project-id  Project ID to pause (uses env if not set)
 *
 * Environment:
 *   SUPABASE_URL - Database URL (required)
 *   SUPABASE_KEY - Database key (required)
 *   PROJECT_ID   - Default project ID
 *
 * Output:
 *   JSON with success status
 */
export {};
//# sourceMappingURL=pause-project.d.ts.map