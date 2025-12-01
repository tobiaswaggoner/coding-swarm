import { NextRequest, NextResponse } from "next/server";
import { createUntypedServerClient } from "@/lib/supabase";
import { auth } from "@/auth";
import type { Conversation, Message } from "@/lib/database.types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/conversations/[id] - Get a conversation with messages
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user || session.user.status !== "authorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createUntypedServerClient();

  // Fetch conversation
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .single();

  if (convError || !conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  // Fetch messages
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (msgError) {
    console.error("Error fetching messages:", msgError);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ...(conversation as Conversation),
    messages: (messages as Message[]) || [],
  });
}

// PATCH /api/conversations/[id] - Update conversation (title, status)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user || session.user.status !== "authorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { title, status } = body;

  const supabase = createUntypedServerClient();

  const updateData: { title?: string; status?: string } = {};
  if (title !== undefined) updateData.title = title;
  if (status !== undefined) updateData.status = status;

  const { data, error } = await supabase
    .from("conversations")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating conversation:", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }

  return NextResponse.json(data as Conversation);
}

// DELETE /api/conversations/[id] - Archive conversation (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user || session.user.status !== "authorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createUntypedServerClient();

  const { error } = await supabase
    .from("conversations")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) {
    console.error("Error archiving conversation:", error);
    return NextResponse.json(
      { error: "Failed to archive conversation" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
