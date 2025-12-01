"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ExternalLink } from "lucide-react";
import type { Project, ProjectStatus } from "@/lib/database.types";

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];

interface ProjectFormProps {
  project?: Project;
  mode: "create" | "edit";
}

export function ProjectForm({ project, mode }: ProjectFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(project?.name || "");
  const [repoUrl, setRepoUrl] = useState(project?.repo_url || "");
  const [defaultBranch, setDefaultBranch] = useState(project?.default_branch || "main");
  const [integrationBranch, setIntegrationBranch] = useState(project?.integration_branch || "");
  const [epic, setEpic] = useState(project?.current_epic || "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status || "active");

  // Generate ID preview (only for create mode)
  const idPreview = mode === "create"
    ? name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    : project?.id || "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const url = mode === "create" ? "/api/projects" : `/api/projects/${project?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const body = mode === "create"
        ? {
            name,
            repo_url: repoUrl,
            default_branch: defaultBranch,
            integration_branch: integrationBranch || null,
            current_epic: epic || null,
          }
        : {
            name,
            status,
            integration_branch: integrationBranch || null,
            current_epic: epic || null,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || `Failed to ${mode} project`);
        setIsSubmitting(false);
        return;
      }

      router.push("/admin/projects");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "create" ? "Create New Project" : "Edit Project"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Read-only fields for edit mode */}
          {mode === "edit" && project && (
            <div className="rounded-md bg-muted/50 p-4">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Read-only Information
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID:</span>
                  <code className="rounded bg-muted px-1">{project.id}</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Repository:</span>
                  <a
                    href={project.repo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    {project.repo_url.replace("https://github.com/", "")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Default Branch:</span>
                  <span>{project.default_branch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span>{new Date(project.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Project Name {mode === "create" && "*"}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Project"
              required
              maxLength={100}
            />
            {mode === "create" && idPreview && (
              <p className="text-xs text-muted-foreground">
                ID: <code className="rounded bg-muted px-1">{idPreview}</code>
              </p>
            )}
          </div>

          {mode === "create" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="repoUrl">GitHub Repository URL *</Label>
                <Input
                  id="repoUrl"
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repository"
                  required
                  pattern="https://github\.com/[\w.-]+/[\w.-]+/?"
                />
                <p className="text-xs text-muted-foreground">
                  Must be a valid GitHub repository URL
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultBranch">Default Branch</Label>
                <Input
                  id="defaultBranch"
                  value={defaultBranch}
                  onChange={(e) => setDefaultBranch(e.target.value)}
                  placeholder="main"
                />
              </div>
            </>
          )}

          {mode === "edit" && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="integrationBranch">Integration Branch</Label>
            <Input
              id="integrationBranch"
              value={integrationBranch}
              onChange={(e) => setIntegrationBranch(e.target.value)}
              placeholder="e.g., feature/new-feature"
            />
            <p className="text-xs text-muted-foreground">
              Optional: Branch for feature integration
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="epic">
              {mode === "create" ? "Epic Description" : "Epic / Current Task"}
            </Label>
            <Textarea
              id="epic"
              value={epic}
              onChange={(e) => setEpic(e.target.value)}
              placeholder={mode === "create" ? "Describe the initial epic or task..." : "Describe the current epic or task..."}
              rows={4}
            />
            {mode === "create" && (
              <p className="text-xs text-muted-foreground">
                Optional: Initial task description for the project
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" asChild>
              <Link href="/admin/projects">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Create Project" : "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
