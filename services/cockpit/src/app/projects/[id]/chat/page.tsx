import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { createServerClient, createUntypedServerClient } from "@/lib/supabase";
import { Header } from "@/components/Header";
import { SystemStatus } from "@/components/SystemStatus";
import { ChatLayout } from "@/components/chat";
import type { Conversation, EngineLock } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ChatPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conversation?: string }>;
}

async function getSystemStatus() {
  const supabase = createServerClient();

  // Get running tasks count
  const { count: runningPods, error: tasksError } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("status", "running");

  // Get total concurrent limit (we'll use 10 as default)
  const totalPods = 10;

  // Get engine lock status
  const { data: engineLockData, error: lockError } = await supabase
    .from("engine_lock")
    .select("*")
    .eq("id", 1)
    .single();

  const engineLock = engineLockData as EngineLock | null;
  const engineHealthy = !lockError && !!engineLock?.holder_id;
  const engineLastHeartbeat = engineLock?.last_heartbeat || null;

  // Supabase is healthy if we got here without errors
  const supabaseHealthy = !tasksError && !lockError;

  return {
    runningPods: runningPods || 0,
    totalPods,
    engineHealthy,
    engineLastHeartbeat,
    supabaseHealthy,
  };
}

export default async function ChatPage({ params, searchParams }: ChatPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.status !== "authorized") {
    redirect("/pending");
  }

  const { id } = await params;
  const { conversation: conversationId } = await searchParams;

  const supabase = createServerClient();
  const untypedSupabase = createUntypedServerClient();

  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("deleted", false)
    .single();

  if (projectError || !project) {
    notFound();
  }

  // Fetch conversations and system status in parallel
  const [conversationsResult, systemStatus] = await Promise.all([
    untypedSupabase
      .from("conversations")
      .select("*")
      .eq("project_id", id)
      .order("updated_at", { ascending: false }),
    getSystemStatus(),
  ]);

  const conversations = (conversationsResult.data as Conversation[]) || [];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="mx-auto w-full max-w-7xl flex-1 flex flex-col overflow-hidden">
          <ChatLayout
            project={project}
            initialConversations={conversations}
            initialConversationId={conversationId}
          />
        </div>
      </main>

      <SystemStatus {...systemStatus} />
    </div>
  );
}
