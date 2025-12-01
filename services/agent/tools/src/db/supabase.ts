/**
 * Supabase Database Client
 *
 * Provides database access for agent operations.
 * Used primarily by project-manager role, but available to others if configured.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// =============================================================================
// Types
// =============================================================================

export type TaskType =
  | "CODE"
  | "MERGE"
  | "REVIEW"
  | "FIX"
  | "PR"
  | "VALIDATE"
  | "WORK"
  | "USER_MESSAGE";

export type TaskStatus = "pending" | "running" | "completed" | "failed";
export type ProjectStatus = "active" | "paused";

export interface TaskResult {
  success: boolean;
  summary: string;
  pr_url?: string;
  pr_number?: number;
  branch?: string;
  conflicts?: boolean;
  decision?: "APPROVE" | "REQUEST_CHANGES" | "REJECT";
  issues?: string[];
  cost_usd?: number;
  duration_ms?: number;
}

export interface Task {
  id: string;
  addressee: string;
  status: TaskStatus;
  prompt: string;
  repo_url: string | null;
  branch: string | null;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  result: TaskResult | null;
  worker_pod: string | null;
  project_id: string | null;
  task_type: TaskType | null;
  triggered_by_task_id: string | null;
  conversation_id: string | null;
}

export interface Project {
  id: string;
  name: string;
  repo_url: string;
  default_branch: string;
  integration_branch: string | null;
  status: ProjectStatus;
  current_epic: string | null;
  last_activity: string;
  created_at: string;
  created_by: string | null;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  pr_url: string | null;
  pr_number: number | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  project_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Input types
// =============================================================================

export interface CreateTaskInput {
  addressee: string;
  prompt: string;
  repo_url?: string;
  branch?: string;
  created_by?: string;
  project_id?: string;
  task_type?: TaskType;
  triggered_by_task_id?: string;
  conversation_id?: string;
}

export interface CreateMessageInput {
  conversation_id: string;
  role: string;
  content: string;
}

// =============================================================================
// Database Client
// =============================================================================

export class Database {
  private client: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.client = createClient(supabaseUrl, supabaseKey);
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  async getTask(taskId: string): Promise<Task | null> {
    const { data, error } = await this.client
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch task: ${error.message}`);
    return data;
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
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

    if (error) throw new Error(`Failed to create task: ${error.message}`);
    return data;
  }

  // ---------------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------------

  async getProject(projectId: string): Promise<Project | null> {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch project: ${error.message}`);
    return data;
  }

  async updateProject(
    projectId: string,
    updates: Partial<Omit<Project, "id" | "created_at">>
  ): Promise<Project | null> {
    const { data, error } = await this.client
      .from("projects")
      .update({
        ...updates,
        last_activity: new Date().toISOString(),
      })
      .eq("id", projectId)
      .select()
      .maybeSingle();

    if (error) throw new Error(`Failed to update project: ${error.message}`);
    return data;
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  async getMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await this.client
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
    return data || [];
  }

  async createMessage(input: CreateMessageInput): Promise<Message> {
    const { data, error } = await this.client
      .from("messages")
      .insert({
        conversation_id: input.conversation_id,
        role: input.role,
        content: input.content,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create message: ${error.message}`);
    return data;
  }

  // ---------------------------------------------------------------------------
  // Conversations
  // ---------------------------------------------------------------------------

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const { data, error } = await this.client
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch conversation: ${error.message}`);
    return data;
  }
}

/**
 * Create a database client if Supabase credentials are available
 */
export function createDatabase(): Database | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    return null;
  }

  return new Database(url, key);
}
