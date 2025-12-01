import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { log } from "../logger.js";

/**
 * Prompt template names for Green Agent
 */
export type PromptTemplate =
  | "code"
  | "merge"
  | "review"
  | "fix"
  | "pr"
  | "validate"
  | "plan-generation";

/**
 * Variables that can be substituted in prompts
 */
export type PromptVariables = Record<string, string | number | undefined>;

/**
 * Default prompts directory - can be overridden via PROMPTS_DIR env var
 * Priority:
 * 1. PROMPTS_DIR environment variable (for K8s ConfigMap/Volume mounts)
 * 2. /prompts/green (container default)
 * 3. ../../prompts/green relative to this file (development)
 */
function getPromptsDir(): string {
  // Environment variable takes priority (K8s ConfigMap mount)
  if (process.env.PROMPTS_DIR) {
    return process.env.PROMPTS_DIR;
  }

  // Container default path
  const containerPath = "/prompts/green";
  if (existsSync(containerPath)) {
    return containerPath;
  }

  // Development fallback - relative to this file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, "..", "..", "..", "prompts", "green");
}

/**
 * Cache for loaded prompts
 */
const promptCache = new Map<string, string>();

/**
 * Load a prompt template from file
 */
export function loadPromptTemplate(template: PromptTemplate): string {
  // Check cache first
  if (promptCache.has(template)) {
    return promptCache.get(template)!;
  }

  const promptsDir = getPromptsDir();
  const filePath = join(promptsDir, `${template}.md`);

  if (!existsSync(filePath)) {
    throw new Error(
      `Prompt template not found: ${filePath}. ` +
        `Set PROMPTS_DIR env var or ensure prompts are mounted.`
    );
  }

  const content = readFileSync(filePath, "utf8");
  promptCache.set(template, content);

  log.debug(`Loaded prompt template: ${template} from ${filePath}`);
  return content;
}

/**
 * Render a prompt template with variables
 *
 * Variables use the format {{VARIABLE_NAME}} in templates
 */
export function renderPrompt(
  template: PromptTemplate,
  variables: PromptVariables
): string {
  let content = loadPromptTemplate(template);

  // Replace all {{VARIABLE_NAME}} placeholders
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    const replacement = value !== undefined ? String(value) : "";
    content = content.split(placeholder).join(replacement);
  }

  // Warn about unreplaced placeholders
  const unreplaced = content.match(/\{\{[A-Z_]+\}\}/g);
  if (unreplaced) {
    log.warn(`Unreplaced placeholders in ${template}: ${unreplaced.join(", ")}`);
  }

  return content;
}

/**
 * Clear the prompt cache (useful for testing or hot-reloading)
 */
export function clearPromptCache(): void {
  promptCache.clear();
}

/**
 * Preload all prompt templates into cache
 */
export function preloadAllPrompts(): void {
  const templates: PromptTemplate[] = [
    "code",
    "merge",
    "review",
    "fix",
    "pr",
    "validate",
    "plan-generation",
  ];

  for (const template of templates) {
    try {
      loadPromptTemplate(template);
    } catch (err) {
      log.warn(`Failed to preload prompt ${template}: ${err}`);
    }
  }

  log.info(`Preloaded ${promptCache.size} prompt templates`);
}
