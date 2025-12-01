#!/usr/bin/env node
/**
 * CLI: Create a new story file in .ai/stories/
 *
 * Creates a story file from template in the backlog directory.
 *
 * Usage:
 *   node dist/create-story.js --epic-id E001 --story-id S001 --name "Story Name"
 *
 * Options:
 *   --epic-id     Epic ID (required, e.g., E001)
 *   --story-id    Story ID (required, e.g., S001)
 *   --name        Story name (required)
 *   --description User story description
 *   --workspace   Workspace path (default: /workspace)
 *   --active      Create in active/ instead of backlog/
 *
 * Environment:
 *   RUNTIME_DIR   Path to runtime repo with templates
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
function parseArgs() {
    const args = {
        workspace: process.env.WORKSPACE || "/workspace",
        active: false,
    };
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = argv[i + 1];
        switch (arg) {
            case "--epic-id":
            case "-e":
                args.epicId = next;
                i++;
                break;
            case "--story-id":
            case "-s":
                args.storyId = next;
                i++;
                break;
            case "--name":
            case "-n":
                args.name = next;
                i++;
                break;
            case "--description":
            case "-d":
                args.description = next;
                i++;
                break;
            case "--workspace":
            case "-w":
                args.workspace = next;
                i++;
                break;
            case "--active":
            case "-a":
                args.active = true;
                break;
        }
    }
    return args;
}
function loadTemplate() {
    const runtimeDir = process.env.RUNTIME_DIR;
    // Try runtime repo first
    if (runtimeDir) {
        const paths = [
            join(runtimeDir, "templates", "story.md.tpl"),
            join(runtimeDir, "templates", "story.md"),
        ];
        for (const p of paths) {
            if (existsSync(p)) {
                return readFileSync(p, "utf8");
            }
        }
    }
    // Fall back to embedded template
    const embeddedPath = "/app/templates/story.md";
    if (existsSync(embeddedPath)) {
        return readFileSync(embeddedPath, "utf8");
    }
    // Minimal fallback
    return `# Story {{STORY_ID}}: {{STORY_NAME}}

## Status
- **Phase**: {{PHASE}}
- **Branch**: {{STORY_BRANCH}}
- **Epic**: {{EPIC_ID}}
- **Created**: {{CREATED_AT}}

## User Story
{{DESCRIPTION}}

## Akzeptanzkriterien
- [ ] Kriterium 1
- [ ] Kriterium 2

## Technische Details
<!-- Hinweise zur Implementierung -->

## Implementation Notes
<!-- Wird vom Developer ausgefuellt -->

## Review Notes
<!-- Wird vom Reviewer ausgefuellt -->
`;
}
function generateSlug(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30);
}
function replaceVars(template, vars) {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        result = result.replace(pattern, value);
    }
    return result;
}
async function main() {
    const args = parseArgs();
    // Validate required args
    if (!args.epicId) {
        console.error("Error: --epic-id is required");
        process.exit(1);
    }
    if (!args.storyId) {
        console.error("Error: --story-id is required");
        process.exit(1);
    }
    if (!args.name) {
        console.error("Error: --name is required");
        process.exit(1);
    }
    const fullId = `${args.epicId}-${args.storyId}`;
    const slug = generateSlug(args.name);
    const branchName = `story/${fullId}-${slug}`;
    const now = new Date().toISOString();
    // Determine target directory
    const targetDir = args.active ? "active" : "backlog";
    const storiesPath = join(args.workspace, ".ai", "stories", targetDir);
    // Ensure directory exists
    if (!existsSync(storiesPath)) {
        mkdirSync(storiesPath, { recursive: true });
    }
    // Generate filename
    const filename = `${fullId}-${slug}.md`;
    const filePath = join(storiesPath, filename);
    // Check if file already exists
    if (existsSync(filePath)) {
        console.error(`Error: Story file already exists: ${filePath}`);
        process.exit(1);
    }
    // Load and fill template
    const template = loadTemplate();
    const vars = {
        STORY_ID: fullId,
        STORY_NAME: args.name,
        STORY_BRANCH: branchName,
        EPIC_ID: args.epicId,
        PHASE: args.active ? "ACTIVE" : "BACKLOG",
        CREATED_AT: now,
        UPDATED_AT: now,
        DESCRIPTION: args.description || "Als [Rolle] moechte ich [Funktion], damit [Nutzen].",
        ROLE: "[Rolle]",
        FEATURE: "[Funktion]",
        BENEFIT: "[Nutzen]",
    };
    const content = replaceVars(template, vars);
    // Write file
    writeFileSync(filePath, content, "utf8");
    // Output result
    console.log(JSON.stringify({
        success: true,
        storyId: fullId,
        name: args.name,
        file: filePath,
        branch: branchName,
        status: args.active ? "ACTIVE" : "BACKLOG",
    }, null, 2));
}
main().catch((err) => {
    console.error(JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
    }, null, 2));
    process.exit(1);
});
//# sourceMappingURL=create-story.js.map