import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <div className="mb-4 text-5xl">🐝</div>
          <h1 className="text-4xl font-bold text-primary">Coding Swarm</h1>
          <p className="mt-2 text-muted-foreground">Cockpit - Control & Monitoring</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to access the dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo: "/" });
              }}
            >
              <Button type="submit" className="w-full gap-2" size="lg">
                <Github className="h-5 w-5" />
                Sign in with GitHub
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Autonomous AI Coding System
        </p>
      </div>
    </div>
  );
}
