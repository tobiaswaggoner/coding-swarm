#!/usr/bin/env node
/**
 * CLI: Initialize .ai/ directory structure in a project
 *
 * Creates the standard .ai/ directory structure for Coding Swarm projects.
 * Can be used to set up a new project or reset an existing structure.
 *
 * Usage:
 *   node dist/init-ai-structure.js [options]
 *
 * Options:
 *   --epic-id     Epic ID (e.g., E001)
 *   --epic-name   Epic name (e.g., "Snake Game")
 *   --workspace   Workspace path (default: /workspace)
 *   --force       Overwrite existing files
 *
 * Environment:
 *   RUNTIME_DIR   Path to runtime repo with templates
 *
 * Creates:
 *   .ai/
 *   ├── README.md
 *   ├── epic/epic.md
 *   ├── stories/{active,backlog,done}/
 *   ├── context/
 *   └── reviews/
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
function parseArgs() {
    const args = {
        workspace: process.env.WORKSPACE || "/workspace",
        force: false,
    };
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = argv[i + 1];
        switch (arg) {
            case "--epic-id":
                args.epicId = next;
                i++;
                break;
            case "--epic-name":
                args.epicName = next;
                i++;
                break;
            case "--workspace":
            case "-w":
                args.workspace = next;
                i++;
                break;
            case "--force":
            case "-f":
                args.force = true;
                break;
        }
    }
    return args;
}
function loadTemplate(name) {
    const runtimeDir = process.env.RUNTIME_DIR;
    // Try runtime repo first
    if (runtimeDir) {
        const runtimePath = join(runtimeDir, "templates", `${name}.md.tpl`);
        if (existsSync(runtimePath)) {
            return readFileSync(runtimePath, "utf8");
        }
        // Also try without .tpl extension
        const runtimePathAlt = join(runtimeDir, "templates", `${name}.md`);
        if (existsSync(runtimePathAlt)) {
            return readFileSync(runtimePathAlt, "utf8");
        }
    }
    // Fall back to embedded templates
    const embeddedPath = join("/app/templates", `${name}.md`);
    if (existsSync(embeddedPath)) {
        return readFileSync(embeddedPath, "utf8");
    }
    // Last resort: return empty string
    console.warn(`Warning: Template '${name}' not found`);
    return "";
}
function replaceVars(template, vars) {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        if (value !== undefined) {
            const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
            result = result.replace(pattern, value);
        }
    }
    return result;
}
function createDirectoryStructure(basePath) {
    const directories = [
        ".ai",
        ".ai/epic",
        ".ai/stories",
        ".ai/stories/active",
        ".ai/stories/backlog",
        ".ai/stories/done",
        ".ai/context",
        ".ai/reviews",
    ];
    for (const dir of directories) {
        const fullPath = join(basePath, dir);
        if (!existsSync(fullPath)) {
            mkdirSync(fullPath, { recursive: true });
            console.log(`  Created: ${dir}/`);
        }
    }
}
function createFile(path, content, force) {
    if (existsSync(path) && !force) {
        console.log(`  Skipped: ${path} (already exists, use --force to overwrite)`);
        return false;
    }
    writeFileSync(path, content, "utf8");
    console.log(`  Created: ${path}`);
    return true;
}
function generateBranchName(epicId, epicName) {
    const slug = epicName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30);
    return `feature/${epicId}-${slug}`;
}
async function main() {
    const args = parseArgs();
    const aiPath = join(args.workspace, ".ai");
    const now = new Date().toISOString();
    console.log("Initializing .ai/ structure...");
    console.log(`  Workspace: ${args.workspace}`);
    // Check if .ai already exists
    if (existsSync(aiPath) && !args.force) {
        // Check if it's empty or has content
        const contents = readdirSync(aiPath);
        if (contents.length > 0) {
            console.log("\n.ai/ directory already exists with content.");
            console.log("Use --force to reinitialize.");
            process.exit(0);
        }
    }
    // Create directory structure
    console.log("\nCreating directories...");
    createDirectoryStructure(args.workspace);
    // Template variables
    const vars = {
        EPIC_ID: args.epicId || "E001",
        EPIC_NAME: args.epicName || "New Epic",
        EPIC_BRANCH: args.epicId && args.epicName
            ? generateBranchName(args.epicId, args.epicName)
            : "feature/E001-new-epic",
        CREATED_AT: now,
        UPDATED_AT: now,
        ROLE: "[Rolle]",
        FEATURE: "[Funktion]",
        BENEFIT: "[Nutzen]",
    };
    // Create README
    console.log("\nCreating files...");
    const readmeContent = loadTemplate("ai-readme");
    if (readmeContent) {
        createFile(join(aiPath, "README.md"), readmeContent, args.force);
    }
    // Create epic.md if epic info provided
    if (args.epicId || args.epicName) {
        const epicTemplate = loadTemplate("epic");
        if (epicTemplate) {
            const epicContent = replaceVars(epicTemplate, vars);
            createFile(join(aiPath, "epic", "epic.md"), epicContent, args.force);
        }
    }
    // Create .gitkeep files to preserve empty directories
    const keepDirs = [
        ".ai/stories/active",
        ".ai/stories/backlog",
        ".ai/stories/done",
        ".ai/context",
        ".ai/reviews",
    ];
    for (const dir of keepDirs) {
        const keepPath = join(args.workspace, dir, ".gitkeep");
        if (!existsSync(keepPath)) {
            writeFileSync(keepPath, "", "utf8");
        }
    }
    console.log("\n.ai/ structure initialized successfully!");
    // Output summary
    console.log("\nStructure:");
    console.log("  .ai/");
    console.log("  ├── README.md");
    if (args.epicId || args.epicName) {
        console.log("  ├── epic/epic.md");
    }
    console.log("  ├── stories/");
    console.log("  │   ├── active/");
    console.log("  │   ├── backlog/");
    console.log("  │   └── done/");
    console.log("  ├── context/");
    console.log("  └── reviews/");
    if (args.epicId && args.epicName) {
        console.log(`\nEpic: ${args.epicId} - ${args.epicName}`);
        console.log(`Branch: ${vars.EPIC_BRANCH}`);
    }
    console.log("\nNext steps:");
    console.log("  1. Edit .ai/epic/epic.md to define the epic");
    console.log("  2. Create stories in .ai/stories/backlog/");
    console.log("  3. Add project context in .ai/context/");
}
main().catch((err) => {
    console.error(`Error: ${err}`);
    process.exit(1);
});
//# sourceMappingURL=init-ai-structure.js.map