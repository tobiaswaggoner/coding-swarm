import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";

/**
 * Task types for the swarm workflow
 */
export type TaskType = "CODE" | "MERGE" | "REVIEW" | "FIX" | "PR" | "VALIDATE";

/**
 * Task record from database
 */
export interface Task {
  id: string;
  addressee: string;
  status: "pending" | "running" | "completed" | "failed";
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
}

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

/**
 * Project status
 */
export type ProjectStatus = "active" | "paused" | "awaiting_review" | "completed" | "failed";

/**
 * Project record from database
 */
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

/**
 * Input for creating a new task
 */
export interface CreateTaskInput {
  addressee: string;
  prompt: string;
  repo_url?: string;
  branch?: string;
  created_by?: string;
  project_id?: string;
  task_type?: TaskType;
  triggered_by_task_id?: string;
}

/**
 * Database client for Green Agent operations
 */
export class TaskDatabase {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /**
   * Get a single task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    const { data, error } = await this.client
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch task: ${error.message}`);
    return data;
  }

  /**
   * Create a new task
   */
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
        status: "pending",
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create task: ${error.message}`);
    return data;
  }

  /**
   * Get a project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch project: ${error.message}`);
    return data;
  }

  /**
   * Update project fields
   */
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

  /**
   * Create a new project
   */
  async createProject(input: {
    id: string;
    name: string;
    repo_url: string;
    default_branch?: string;
    integration_branch?: string;
    current_epic?: string;
    created_by?: string;
  }): Promise<Project> {
    const { data, error } = await this.client
      .from("projects")
      .insert({
        id: input.id,
        name: input.name,
        repo_url: input.repo_url,
        default_branch: input.default_branch || "main",
        integration_branch: input.integration_branch || null,
        current_epic: input.current_epic || null,
        created_by: input.created_by || null,
        status: "active",
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create project: ${error.message}`);
    return data;
  }
}
