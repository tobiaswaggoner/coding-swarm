/**
 * Supabase Database Client
 *
 * Provides database access for agent operations.
 * Used primarily by project-manager role, but available to others if configured.
 */
import { createClient } from "@supabase/supabase-js";
// =============================================================================
// Database Client
// =============================================================================
export class Database {
    client;
    constructor(supabaseUrl, supabaseKey) {
        this.client = createClient(supabaseUrl, supabaseKey);
    }
    // ---------------------------------------------------------------------------
    // Tasks
    // ---------------------------------------------------------------------------
    async getTask(taskId) {
        const { data, error } = await this.client
            .from("tasks")
            .select("*")
            .eq("id", taskId)
            .maybeSingle();
        if (error)
            throw new Error(`Failed to fetch task: ${error.message}`);
        return data;
    }
    async createTask(input) {
        const { data, error } = await this.client
            .from("tasks")
            .insert({
            addressee: input.addressee,
            prompt: input.prompt,
            repo_url: input.repo_url || null,
            branch: input.branch || null,
            created_by: input.created_by || null,
            project_id: input.project_id || null,
            task_type: input.task_type || null,
            triggered_by_task_id: input.triggered_by_task_id || null,
            conversation_id: input.conversation_id || null,
            status: "pending",
        })
            .select()
            .single();
        if (error)
            throw new Error(`Failed to create task: ${error.message}`);
        return data;
    }
    // ---------------------------------------------------------------------------
    // Projects
    // ---------------------------------------------------------------------------
    async getProject(projectId) {
        const { data, error } = await this.client
            .from("projects")
            .select("*")
            .eq("id", projectId)
            .maybeSingle();
        if (error)
            throw new Error(`Failed to fetch project: ${error.message}`);
        return data;
    }
    async updateProject(projectId, updates) {
        const { data, error } = await this.client
            .from("projects")
            .update({
            ...updates,
            last_activity: new Date().toISOString(),
        })
            .eq("id", projectId)
            .select()
            .maybeSingle();
        if (error)
            throw new Error(`Failed to update project: ${error.message}`);
        return data;
    }
    // ---------------------------------------------------------------------------
    // Messages
    // ---------------------------------------------------------------------------
    async getMessages(conversationId) {
        const { data, error } = await this.client
            .from("messages")
            .select("*")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true });
        if (error)
            throw new Error(`Failed to fetch messages: ${error.message}`);
        return data || [];
    }
    async createMessage(input) {
        const { data, error } = await this.client
            .from("messages")
            .insert({
            conversation_id: input.conversation_id,
            role: input.role,
            content: input.content,
        })
            .select()
            .single();
        if (error)
            throw new Error(`Failed to create message: ${error.message}`);
        return data;
    }
    // ---------------------------------------------------------------------------
    // Conversations
    // ---------------------------------------------------------------------------
    async getConversation(conversationId) {
        const { data, error } = await this.client
            .from("conversations")
            .select("*")
            .eq("id", conversationId)
            .maybeSingle();
        if (error)
            throw new Error(`Failed to fetch conversation: ${error.message}`);
        return data;
    }
}
/**
 * Create a database client if Supabase credentials are available
 */
export function createDatabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) {
        return null;
    }
    return new Database(url, key);
}
//# sourceMappingURL=supabase.js.map