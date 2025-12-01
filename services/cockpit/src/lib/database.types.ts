export type TaskStatus = "pending" | "running" | "completed" | "failed";
export type TaskType = "CODE" | "MERGE" | "REVIEW" | "FIX" | "PR" | "VALIDATE" | "USER_MESSAGE";
export type ProjectStatus =
  | "active"
  | "paused"
  | "awaiting_review"
  | "completed"
  | "failed";

export interface TaskResult {
  success: boolean;
  summary?: string;
  pr_url?: string;
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
}

export interface TaskLog {
  id: string;
  task_id: string;
  jsonl_content: string;
  log_size_bytes: number | null;
  created_at: string;
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
  // Soft delete fields
  deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface EngineLock {
  id: number;
  holder_id: string | null;
  acquired_at: string | null;
  last_heartbeat: string | null;
}

export type CockpitUserStatus = "pending" | "authorized" | "blocked";

export interface CockpitUser {
  id: string;
  github_id: string;
  github_username: string | null;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  status: CockpitUserStatus;
  authorized_by: string | null;
  authorized_at: string | null;
  created_at: string;
  last_login: string;
}

// Conversation types
export type ConversationStatus = "active" | "archived";
export type MessageRole = "user" | "green" | "blue" | "system";

export interface Conversation {
  id: string;
  project_id: string;
  title: string | null;
  status: ConversationStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  triggers_task_id: string | null;
}

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: Task;
        Insert: Omit<Task, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Task>;
      };
      task_logs: {
        Row: TaskLog;
        Insert: Omit<TaskLog, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<TaskLog>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, "created_at" | "last_activity" | "total_tasks" | "completed_tasks" | "failed_tasks" | "deleted" | "deleted_at" | "deleted_by"> & {
          created_at?: string;
          last_activity?: string;
          total_tasks?: number;
          completed_tasks?: number;
          failed_tasks?: number;
          deleted?: boolean;
          deleted_at?: string;
          deleted_by?: string;
        };
        Update: Partial<Project>;
      };
      engine_lock: {
        Row: EngineLock;
        Insert: EngineLock;
        Update: Partial<EngineLock>;
      };
      cockpit_users: {
        Row: CockpitUser;
        Insert: Omit<CockpitUser, "id" | "created_at" | "last_login"> & {
          id?: string;
          created_at?: string;
          last_login?: string;
        };
        Update: Partial<CockpitUser>;
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Conversation>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Message>;
      };
    };
  };
}
