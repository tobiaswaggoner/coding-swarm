import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { createServerClient, createUntypedServerClient } from "@/lib/supabase";
import { ChatLayout } from "@/components/chat";
import type { Conversation } from "@/lib/database.types";

interface ChatPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conversation?: string }>;
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

  // Fetch conversations for this project
  const { data: conversations } = await untypedSupabase
    .from("conversations")
    .select("*")
    .eq("project_id", id)
    .order("updated_at", { ascending: false });

  return (
    <ChatLayout
      project={project}
      initialConversations={(conversations as Conversation[]) || []}
      initialConversationId={conversationId}
    />
  );
}
