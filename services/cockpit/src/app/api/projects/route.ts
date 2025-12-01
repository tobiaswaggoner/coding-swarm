import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createServerClient } from "@/lib/supabase";
import type { Project } from "@/lib/database.types";

// GET /api/projects - List all projects
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.status !== "authorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("includeDeleted") === "true";

  let query = supabase
    .from("projects")
    .select("*")
    .order("last_activity", { ascending: false });

  if (!includeDeleted) {
    query = query.eq("deleted", false);
  }

  const { data: projects, error } = await query;

  if (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }

  return NextResponse.json(projects as Project[]);
}

// POST /api/projects - Create new project
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.status !== "authorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, repo_url, default_branch, integration_branch, current_epic } = body;

  // Validation
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (name.length > 100) {
    return NextResponse.json({ error: "Name must be 100 characters or less" }, { status: 400 });
  }

  if (!repo_url || typeof repo_url !== "string") {
    return NextResponse.json({ error: "Repository URL is required" }, { status: 400 });
  }

  // Validate GitHub URL
  const githubUrlPattern = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;
  if (!githubUrlPattern.test(repo_url)) {
    return NextResponse.json({ error: "Invalid GitHub repository URL" }, { status: 400 });
  }

  // Generate ID from name (kebab-case)
  const id = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!id) {
    return NextResponse.json({ error: "Could not generate valid ID from name" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Check if ID already exists
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "A project with this name already exists" }, { status: 409 });
  }

  // Create project
  const newProject = {
    id,
    name: name.trim(),
    repo_url: repo_url.trim().replace(/\/$/, ""), // Remove trailing slash
    default_branch: default_branch?.trim() || "main",
    integration_branch: integration_branch?.trim() || null,
    current_epic: current_epic?.trim() || null,
    status: "active" as const,
    created_by: session.user.id,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project, error } = await (supabase.from("projects") as any)
    .insert(newProject)
    .select()
    .single();

  if (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }

  return NextResponse.json(project as Project, { status: 201 });
}
