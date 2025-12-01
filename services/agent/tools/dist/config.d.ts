/**
 * Unified Agent Configuration
 *
 * Loads configuration from environment variables with role-based requirements.
 * Some variables are required for all roles, others only for specific roles.
 */
export type AgentRole = "developer" | "project-manager" | "reviewer";
/**
 * Base configuration available to all roles
 */
export interface BaseConfig {
    role: AgentRole;
    runtimeDir: string;
    targetRepo: string;
    targetBranch: string;
    baseBranch: string;
    taskPrompt: string;
    taskId: string;
    gitUserEmail: string;
    gitUserName: string;
    outputFormat: string;
    githubContext: string;
}
/**
 * Extended configuration for project-manager role
 */
export interface ProjectManagerConfig extends BaseConfig {
    supabaseUrl: string;
    supabaseKey: string;
    projectId: string;
    integrationBranch: string;
    triggeredByTaskId: string;
    conversationId: string;
}
/**
 * Load base configuration (available to all roles)
 */
export declare function loadBaseConfig(): BaseConfig;
/**
 * Load project-manager specific configuration
 * Throws if required PM variables are missing
 */
export declare function loadProjectManagerConfig(): ProjectManagerConfig;
/**
 * Check if Supabase is available (for optional database features)
 */
export declare function hasSupabase(): boolean;
/**
 * Get the config appropriate for the current role
 */
export declare function loadConfig(): BaseConfig | ProjectManagerConfig;
//# sourceMappingURL=config.d.ts.map