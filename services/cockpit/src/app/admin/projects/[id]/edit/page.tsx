import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { ProjectForm } from "@/components/ProjectForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { createServerClient } from "@/lib/supabase";
import type { Project } from "@/lib/database.types";

export const dynamic = "force-dynamic";

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

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="mb-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/projects" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Projects
              </Link>
            </Button>
          </div>

          <ProjectForm project={project} mode="edit" />
        </div>
      </main>
    </div>
  );
}
