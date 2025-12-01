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
import { createDatabase } from "./db/supabase.js";
function parseArgs() {
    const args = {};
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = argv[i + 1];
        switch (arg) {
            case "--project-id":
            case "-p":
                args.projectId = next;
                i++;
                break;
        }
    }
    return args;
}
async function main() {
    const args = parseArgs();
    // Resolve project ID
    const projectId = args.projectId || process.env.PROJECT_ID;
    if (!projectId) {
        console.error("Error: --project-id is required (or set PROJECT_ID env)");
        process.exit(1);
    }
    // Create database client
    const db = createDatabase();
    if (!db) {
        console.error("Error: SUPABASE_URL and SUPABASE_KEY are required");
        process.exit(1);
    }
    try {
        const project = await db.updateProject(projectId, { status: "paused" });
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }
        // Output result
        console.log(JSON.stringify({
            success: true,
            projectId: project.id,
            status: project.status,
        }, null, 2));
    }
    catch (error) {
        console.error(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
        }, null, 2));
        process.exit(1);
    }
}
main();
//# sourceMappingURL=pause-project.js.map