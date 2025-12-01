import { auth } from "@/auth";
import { Header } from "@/components/Header";
import { createServerClient } from "@/lib/supabase";
import type { Project } from "@/lib/database.types";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Archive,
  ExternalLink,
  GitBranch,
  FolderKanban,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const dynamic = "force-dynamic";

async function getProjects(includeDeleted: boolean): Promise<Project[]> {
  const supabase = createServerClient();

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
    return [];
  }

  return (projects as Project[]) || [];
}

async function archiveProject(formData: FormData) {
  "use server";

  const projectId = formData.get("projectId") as string;
  const session = await auth();

  if (!session?.user?.id) return;

  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("projects") as any)
    .update({
      deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: session.user.id,
    })
    .eq("id", projectId);

  revalidatePath("/admin/projects");
}

function getStatusBadge(status: Project["status"], deleted: boolean) {
  if (deleted) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Archive className="h-3 w-3" />
        Archived
      </Badge>
    );
  }

  switch (status) {
    case "active":
      return <Badge className="bg-green-600">Active</Badge>;
    case "paused":
      return <Badge variant="secondary">Paused</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ showArchived?: string }>;
}) {
  const params = await searchParams;
  const showArchived = params.showArchived === "true";
  const projects = await getProjects(showArchived);

  const activeProjects = projects.filter((p) => !p.deleted);
  const archivedProjects = projects.filter((p) => p.deleted);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/projects/new" className="gap-2">
                <Plus className="h-4 w-4" />
                New Project
              </Link>
            </Button>
          </div>

          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">
              Project Management
            </h1>
            <Link
              href={`/admin/projects${showArchived ? "" : "?showArchived=true"}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {showArchived ? "Hide archived" : "Show archived"}
            </Link>
          </div>

          {/* Active Projects */}
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <FolderKanban className="h-5 w-5 text-primary" />
              Projects ({activeProjects.length})
            </h2>
            {activeProjects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No projects yet.</p>
                  <Button asChild className="mt-4">
                    <Link href="/admin/projects/new" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Create your first project
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {activeProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onArchive={archiveProject}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Archived Projects */}
          {showArchived && archivedProjects.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-muted-foreground">
                <Archive className="h-5 w-5" />
                Archived ({archivedProjects.length})
              </h2>
              <div className="space-y-3 opacity-60">
                {archivedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onArchive={archiveProject}
                    isArchived
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function ProjectCard({
  project,
  onArchive,
  isArchived = false,
}: {
  project: Project;
  onArchive: (formData: FormData) => Promise<void>;
  isArchived?: boolean;
}) {
  return (
    <Card className={isArchived ? "border-dashed" : ""}>
      <CardContent className="flex items-center justify-between p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/projects/${project.id}`}
              className="font-medium text-foreground hover:text-primary"
            >
              {project.name}
            </Link>
            {getStatusBadge(project.status, project.deleted)}
          </div>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <a
              href={project.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              {project.repo_url.replace("https://github.com/", "")}
            </a>
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {project.default_branch}
            </span>
          </div>
          {project.current_epic && (
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {project.current_epic}
            </p>
          )}
          <div className="mt-1 text-xs text-muted-foreground">
            ID: {project.id} • Last activity:{" "}
            {new Date(project.last_activity).toLocaleDateString()}
          </div>
        </div>

        {!isArchived && (
          <div className="ml-4 flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/projects/${project.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Archive className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive Project</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to archive &quot;{project.name}&quot;? The project
                    will be hidden from the dashboard but can be viewed by
                    enabling &quot;Show archived&quot;.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <form action={onArchive}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <AlertDialogAction type="submit">Archive</AlertDialogAction>
                  </form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
