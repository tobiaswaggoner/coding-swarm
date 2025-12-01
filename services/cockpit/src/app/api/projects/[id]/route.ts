import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import type { Project, ProjectStatus } from "@/lib/database.types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id] - Get single project
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.status !== "authorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createServerClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project as Project);
}

// PATCH /api/projects/[id] - Update project
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.status !== "authorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const { name, integration_branch, current_epic, status } = body;

  const supabase = createServerClient();

  // Check if project exists
  const { data: existing, error: fetchError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Build update object (only include provided fields)
  const updates: Partial<Project> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: "Name must be 100 characters or less" }, { status: 400 });
    }
    updates.name = name.trim();
  }

  if (integration_branch !== undefined) {
    updates.integration_branch = integration_branch?.trim() || null;
  }

  if (current_epic !== undefined) {
    updates.current_epic = current_epic?.trim() || null;
  }

  if (status !== undefined) {
    const validStatuses: ProjectStatus[] = ["active", "paused", "awaiting_review", "completed", "failed"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Update last_activity
  updates.last_activity = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project, error } = await (supabase.from("projects") as any)
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating project:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }

  return NextResponse.json(project as Project);
}

// DELETE /api/projects/[id] - Archive project (soft delete)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.status !== "authorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createServerClient();

  // Check if project exists
  const { data: existing, error: fetchError } = await supabase
    .from("projects")
    .select("id, deleted")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if ((existing as Project).deleted) {
    return NextResponse.json({ error: "Project is already archived" }, { status: 400 });
  }

  // Soft delete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("projects") as any)
    .update({
      deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: session.user.id,
    })
    .eq("id", id);

  if (error) {
    console.error("Error archiving project:", error);
    return NextResponse.json({ error: "Failed to archive project" }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Project archived" });
}
