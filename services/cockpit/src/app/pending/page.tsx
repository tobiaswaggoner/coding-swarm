import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock } from "lucide-react";

export default async function PendingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.status === "authorized") {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-4 text-center">
        <div>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-6 text-3xl font-bold text-foreground">
            Awaiting Authorization
          </h1>
          <p className="mt-4 text-muted-foreground">
            Your account has been registered but is not yet authorized to access
            the Coding Swarm Cockpit.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Signed in as</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={session.user.image || undefined} alt={session.user.name || "User"} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {session.user.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="font-medium text-foreground">{session.user.name}</p>
                <p className="text-sm text-muted-foreground">{session.user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          An administrator will review your request and grant access. You will
          be able to access the dashboard once authorized.
        </p>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="outline" className="w-full">
            Sign out and try another account
          </Button>
        </form>
      </div>
    </div>
  );
}
