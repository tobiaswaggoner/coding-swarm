/**
 * Configuration loaded from environment variables.
 * All required variables throw on missing values.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config = {
  // Supabase
  supabaseUrl: required("SUPABASE_URL"),
  supabaseKey: required("SUPABASE_KEY"),

  // Project context
  projectId: required("PROJECT_ID"),
  repoUrl: optional("REPO_URL", ""),
  branch: optional("BRANCH", "main"),
  integrationBranch: optional("INTEGRATION_BRANCH", ""),

  // Trigger context
  taskPrompt: optional("TASK_PROMPT", ""),
  triggeredByTaskId: optional("TRIGGERED_BY_TASK_ID", ""),
  conversationId: optional("CONVERSATION_ID", ""),

  // Git config
  gitUserEmail: optional("GIT_USER_EMAIL", "ai-agent@coding-swarm.local"),
  gitUserName: optional("GIT_USER_NAME", "Coding Swarm Agent"),
} as const;

export type Config = typeof config;
