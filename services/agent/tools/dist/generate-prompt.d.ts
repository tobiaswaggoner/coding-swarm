#!/usr/bin/env node
/**
 * Unified Prompt Generator for all Agent Roles
 *
 * This script builds the complete context prompt based on:
 * - Agent role (developer, project-manager, reviewer)
 * - Runtime configuration (from coding-swarm-runtime repo)
 * - Project context (from .ai/ directory)
 * - GitHub context (branches, commits, PRs)
 * - Database context (for project-manager: tasks, conversations)
 *
 * Usage:
 *   node dist/generate-prompt.js
 *
 * Environment:
 *   AGENT_ROLE          - Role: developer, project-manager, reviewer
 *   RUNTIME_DIR         - Path to cloned runtime repo (optional)
 *   TASK_PROMPT         - Direct task description
 *   GITHUB_CONTEXT      - Pre-collected GitHub info
 *   PROJECT_ID          - Project ID (for project-manager)
 *   TRIGGERED_BY_TASK_ID - Triggering task (for project-manager)
 *   CONVERSATION_ID     - Active conversation (for project-manager)
 *
 * Output:
 *   Prints the complete prompt to stdout
 */
export {};
//# sourceMappingURL=generate-prompt.d.ts.map