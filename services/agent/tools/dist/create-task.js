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
import { createDatabase } from "./db/supabase.js";
function parseArgs() {
    const args = {};
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = argv[i + 1];
        switch (arg) {
            case "--prompt":
            case "-p":
                args.prompt = next;
                i++;
                break;
            case "--branch":
            case "-b":
                args.branch = next;
                i++;
                break;
            case "--repo-url":
            case "-r":
                args.repoUrl = next;
                i++;
                break;
            case "--project-id":
                args.projectId = next;
                i++;
                break;
            case "--conversation-id":
                args.conversationId = next;
                i++;
                break;
            case "--task-type":
            case "-t":
                args.taskType = next;
                i++;
                break;
        }
    }
    return args;
}
function generateAddressee(projectId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    const prefix = projectId ? `dev-${projectId.slice(0, 8)}` : "dev";
    return `${prefix}-${timestamp}-${random}`;
}
async function main() {
    const args = parseArgs();
    // Validate required args
    if (!args.prompt) {
        console.error("Error: --prompt is required");
        console.error("Usage: node create-task.js --prompt 'Task description'");
        process.exit(1);
    }
    // Create database client
    const db = createDatabase();
    if (!db) {
        console.error("Error: SUPABASE_URL and SUPABASE_KEY are required");
        process.exit(1);
    }
    // Resolve values
    const projectId = args.projectId || process.env.PROJECT_ID;
    const repoUrl = args.repoUrl || process.env.REPO_URL || process.env.TARGET_REPO;
    const conversationId = args.conversationId || process.env.CONVERSATION_ID;
    // Generate unique addressee for concurrency control
    const addressee = generateAddressee(projectId);
    try {
        const task = await db.createTask({
            addressee,
            prompt: args.prompt,
            branch: args.branch || undefined,
            repo_url: repoUrl || undefined,
            project_id: projectId || undefined,
            task_type: args.taskType || "WORK",
            conversation_id: conversationId || undefined,
            created_by: "project-manager",
        });
        // Output result
        console.log(JSON.stringify({
            success: true,
            taskId: task.id,
            addressee: task.addressee,
            branch: task.branch,
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
//# sourceMappingURL=create-task.js.map