/**
 * Unified Agent Configuration
 *
 * Loads configuration from environment variables with role-based requirements.
 * Some variables are required for all roles, others only for specific roles.
 */

export type AgentRole = "developer" | "project-manager" | "reviewer";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, defaultValue: string = ""): string {
  return process.env[name] || defaultValue;
}

function optionalBoolean(name: string, defaultValue: boolean = false): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * Base configuration available to all roles
 */
export interface BaseConfig {
  // Agent identity
  role: AgentRole;
  runtimeDir: string;

  // Target repository
  targetRepo: string;
  targetBranch: string;
  baseBranch: string;

  // Task context
  taskPrompt: string;
  taskId: string;

  // Git config
  gitUserEmail: string;
  gitUserName: string;

  // Output
  outputFormat: string;

  // GitHub context (collected by entrypoint)
  githubContext: string;
}

/**
 * Extended configuration for project-manager role
 */
export interface ProjectManagerConfig extends BaseConfig {
  // Database access
  supabaseUrl: string;
  supabaseKey: string;

  // Project context
  projectId: string;
  integrationBranch: string;

  // Trigger context
  triggeredByTaskId: string;
  conversationId: string;
}

/**
 * Load base configuration (available to all roles)
 */
export function loadBaseConfig(): BaseConfig {
  return {
    role: (optional("AGENT_ROLE", "developer") as AgentRole),
    runtimeDir: optional("RUNTIME_DIR", "/tmp/runtime"),

    targetRepo: optional("TARGET_REPO", optional("REPO_URL", "")),
    targetBranch: optional("TARGET_BRANCH", optional("BRANCH", "")),
    baseBranch: optional("BASE_BRANCH", "main"),

    taskPrompt: optional("TASK_PROMPT", ""),
    taskId: optional("TASK_ID", ""),

    gitUserEmail: optional("GIT_USER_EMAIL", "ai-agent@coding-swarm.local"),
    gitUserName: optional("GIT_USER_NAME", "Coding Swarm Agent"),

    outputFormat: optional("OUTPUT_FORMAT", "stream-json"),

    githubContext: optional("GITHUB_CONTEXT", ""),
  };
}

/**
 * Load project-manager specific configuration
 * Throws if required PM variables are missing
 */
export function loadProjectManagerConfig(): ProjectManagerConfig {
  const base = loadBaseConfig();

  if (base.role !== "project-manager") {
    throw new Error("loadProjectManagerConfig called but AGENT_ROLE is not project-manager");
  }

  return {
    ...base,

    supabaseUrl: required("SUPABASE_URL"),
    supabaseKey: required("SUPABASE_KEY"),

    projectId: required("PROJECT_ID"),
    integrationBranch: optional("INTEGRATION_BRANCH", ""),

    triggeredByTaskId: optional("TRIGGERED_BY_TASK_ID", ""),
    conversationId: optional("CONVERSATION_ID", ""),
  };
}

/**
 * Check if Supabase is available (for optional database features)
 */
export function hasSupabase(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
}

/**
 * Get the config appropriate for the current role
 */
export function loadConfig(): BaseConfig | ProjectManagerConfig {
  const role = optional("AGENT_ROLE", "developer");

  if (role === "project-manager") {
    return loadProjectManagerConfig();
  }

  return loadBaseConfig();
}
