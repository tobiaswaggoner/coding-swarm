import { NextRequest, NextResponse } from "next/server";
import { createUntypedServerClient } from "@/lib/supabase";
import { auth } from "@/auth";
import type { Message, Conversation, Task } from "@/lib/database.types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/conversations/[id]/messages - Get messages for a conversation
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user || session.user.status !== "authorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createUntypedServerClient();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }

  return NextResponse.json((data as Message[]) || []);
}

// POST /api/conversations/[id]/messages - Send a new message
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user || session.user.status !== "authorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;
  const body = await request.json();
  const { content, role = "user" } = body;

  if (!content || !content.trim()) {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 }
    );
  }

  const supabase = createUntypedServerClient();

  // Get the conversation to find the project_id
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("*, projects!inner(repo_url, default_branch)")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    console.error("Error fetching conversation:", convError);
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const conv = conversation as Conversation & { projects: { repo_url: string; default_branch: string } };

  // Insert the message
  const { data: message, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role,
      content: content.trim(),
    })
    .select()
    .single();

  if (msgError) {
    console.error("Error creating message:", msgError);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }

  // If this is a user message, create a USER_MESSAGE task for Green
  if (role === "user") {
    const taskPrompt = `New user message in conversation "${conv.title || "Untitled"}".

Conversation ID: ${conversationId}
Project ID: ${conv.project_id}

Read all messages in this conversation and respond appropriately. If coding work is needed, create the appropriate CODE tasks.

Your response will be automatically saved as a message with role "green".`;

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        addressee: `project-mgr-${conv.project_id}`,
        status: "pending",
        prompt: taskPrompt,
        repo_url: conv.projects.repo_url,
        branch: conv.projects.default_branch,
        project_id: conv.project_id,
        task_type: "USER_MESSAGE",
        created_by: session.user.name || session.user.email || "cockpit-user",
      })
      .select()
      .single();

    if (taskError) {
      console.error("Error creating USER_MESSAGE task:", taskError);
      // Don't fail the message creation, just log the error
    } else if (task) {
      // Update the message with the task reference
      const createdTask = task as Task;
      await supabase
        .from("messages")
        .update({ triggers_task_id: createdTask.id })
        .eq("id", (message as Message).id);
    }

    // Update conversation title from first message if not set
    if (!conv.title) {
      const truncatedTitle = content.trim().substring(0, 50) + (content.length > 50 ? "..." : "");
      await supabase
        .from("conversations")
        .update({ title: truncatedTitle })
        .eq("id", conversationId);
    }
  }

  return NextResponse.json(message as Message, { status: 201 });
}
