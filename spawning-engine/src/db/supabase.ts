import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";

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
}

export interface TaskResult {
  success: boolean;
  summary: string;
  pr_url?: string;
  cost_usd?: number;
  duration_ms?: number;
}

/**
 * Database client for task operations
 */
export class TaskDatabase {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /**
   * Get one pending task per addressee (oldest first)
   */
  async getPendingTasksPerAddressee(): Promise<Task[]> {
    // Supabase doesn't support DISTINCT ON, so we fetch all pending and dedupe
    const { data, error } = await this.client
      .from("tasks")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) throw new Error(`Failed to fetch pending tasks: ${error.message}`);
    if (!data) return [];

    // Dedupe: keep only first (oldest) per addressee
    const seen = new Set<string>();
    const result: Task[] = [];
    for (const task of data) {
      if (!seen.has(task.addressee)) {
        seen.add(task.addressee);
        result.push(task);
      }
    }
    return result;
  }

  /**
   * Get all running tasks (for timeout check)
   */
  async getRunningTasks(): Promise<Task[]> {
    const { data, error } = await this.client
      .from("tasks")
      .select("*")
      .eq("status", "running");

    if (error) throw new Error(`Failed to fetch running tasks: ${error.message}`);
    return data || [];
  }

  /**
   * Count currently running tasks
   */
  async countRunningTasks(): Promise<number> {
    const { count, error } = await this.client
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "running");

    if (error) throw new Error(`Failed to count running tasks: ${error.message}`);
    return count || 0;
  }

  /**
   * Check if addressee has a running task
   */
  async hasRunningTask(addressee: string): Promise<boolean> {
    const { count, error } = await this.client
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("addressee", addressee)
      .eq("status", "running");

    if (error) throw new Error(`Failed to check running task: ${error.message}`);
    return (count || 0) > 0;
  }

  /**
   * Claim a task (atomic: only succeeds if still pending)
   */
  async claimTask(taskId: string, workerPod: string): Promise<Task | null> {
    const { data, error } = await this.client
      .from("tasks")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        worker_pod: workerPod,
      })
      .eq("id", taskId)
      .eq("status", "pending") // Only if still pending
      .select()
      .single();

    if (error) {
      // No rows updated = task was claimed by another process
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to claim task: ${error.message}`);
    }
    return data;
  }

  /**
   * Mark task as completed with result (atomic: only if still running)
   * Returns true if update succeeded, false if task was already completed/failed
   */
  async completeTask(taskId: string, result: TaskResult): Promise<boolean> {
    const { data, error } = await this.client
      .from("tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        result,
      })
      .eq("id", taskId)
      .eq("status", "running") // Only if still running
      .select()
      .maybeSingle();

    if (error) throw new Error(`Failed to complete task: ${error.message}`);
    return data !== null; // true if row was updated
  }

  /**
   * Mark task as failed with result (atomic: only if still running)
   * Returns true if update succeeded, false if task was already completed/failed
   */
  async failTask(taskId: string, result: TaskResult): Promise<boolean> {
    const { data, error } = await this.client
      .from("tasks")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        result,
      })
      .eq("id", taskId)
      .eq("status", "running") // Only if still running
      .select()
      .maybeSingle();

    if (error) throw new Error(`Failed to fail task: ${error.message}`);
    return data !== null; // true if row was updated
  }

  /**
   * Save task logs (JSONL from Claude CLI)
   */
  async saveTaskLogs(taskId: string, jsonlContent: string): Promise<void> {
    const { error } = await this.client.from("task_logs").insert({
      task_id: taskId,
      jsonl_content: jsonlContent,
      log_size_bytes: Buffer.byteLength(jsonlContent, "utf8"),
    });

    if (error) throw new Error(`Failed to save task logs: ${error.message}`);
  }
}
