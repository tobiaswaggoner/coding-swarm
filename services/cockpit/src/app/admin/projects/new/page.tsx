import Link from "next/link";
import { Header } from "@/components/Header";
import { ProjectForm } from "@/components/ProjectForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NewProjectPage() {
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

          <ProjectForm mode="create" />
        </div>
      </main>
    </div>
  );
}
