import { NextRequest, NextResponse } from "next/server";
import { createUntypedServerClient } from "@/lib/supabase";
import { auth } from "@/auth";
import type { Conversation, CockpitUser } from "@/lib/database.types";

// GET /api/conversations?projectId=xxx - List conversations for a project
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.status !== "authorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  const supabase = createUntypedServerClient();

  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }

  return NextResponse.json((data as Conversation[]) || []);
}

// POST /api/conversations - Create a new conversation
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.status !== "authorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { project_id, title } = body;

  if (!project_id) {
    return NextResponse.json(
      { error: "project_id is required" },
      { status: 400 }
    );
  }

  const supabase = createUntypedServerClient();

  // Get the user's cockpit_user ID
  const { data: cockpitUserData } = await supabase
    .from("cockpit_users")
    .select("id")
    .eq("github_id", session.user.githubId)
    .single();

  const cockpitUser = cockpitUserData as CockpitUser | null;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      project_id,
      title: title || null,
      status: "active",
      created_by: cockpitUser?.id || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }

  return NextResponse.json(data as Conversation, { status: 201 });
}
