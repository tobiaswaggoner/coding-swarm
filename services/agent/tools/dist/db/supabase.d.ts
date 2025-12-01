/**
 * Supabase Database Client
 *
 * Provides database access for agent operations.
 * Used primarily by project-manager role, but available to others if configured.
 */
export type TaskType = "CODE" | "MERGE" | "REVIEW" | "FIX" | "PR" | "VALIDATE" | "WORK" | "USER_MESSAGE";
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
export declare class Database {
    private client;
    constructor(supabaseUrl: string, supabaseKey: string);
    getTask(taskId: string): Promise<Task | null>;
    createTask(input: CreateTaskInput): Promise<Task>;
    getProject(projectId: string): Promise<Project | null>;
    updateProject(projectId: string, updates: Partial<Omit<Project, "id" | "created_at">>): Promise<Project | null>;
    getMessages(conversationId: string): Promise<Message[]>;
    createMessage(input: CreateMessageInput): Promise<Message>;
    getConversation(conversationId: string): Promise<Conversation | null>;
}
/**
 * Create a database client if Supabase credentials are available
 */
export declare function createDatabase(): Database | null;
//# sourceMappingURL=supabase.d.ts.map