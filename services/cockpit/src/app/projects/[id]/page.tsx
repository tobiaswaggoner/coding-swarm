import { Header } from "@/components/Header";
import { createServerClient } from "@/lib/supabase";
import type { Project } from "@/lib/database.types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Construction } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

async function getProject(id: string): Promise<Project | null> {
  const supabase = createServerClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !project) {
    return null;
  }

  return project as Project;
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>

          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{project.repo_url}</p>
            </div>
            <Badge variant="secondary">
              {project.status}
            </Badge>
          </div>

          {/* Placeholder for Phase 2 */}
          <Card className="mb-8">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Construction className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mt-4 text-lg font-medium text-foreground">
                Project Detail View - Coming Soon
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Task history, log visualization, and controls will be implemented
                in Phase 2
              </p>
            </CardContent>
          </Card>

          {/* Basic project info */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoCard
              title="Epic"
              value={project.current_epic || "No epic defined"}
            />
            <InfoCard
              title="Progress"
              value={`${project.completed_tasks}/${project.total_tasks} tasks`}
            />
            <InfoCard
              title="Failed Tasks"
              value={String(project.failed_tasks)}
            />
            <InfoCard
              title="Integration Branch"
              value={project.integration_branch || project.default_branch}
            />
            <InfoCard
              title="Last Activity"
              value={new Date(project.last_activity).toLocaleString()}
            />
            <InfoCard
              title="Created"
              value={new Date(project.created_at).toLocaleString()}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
