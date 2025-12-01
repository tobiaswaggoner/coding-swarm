import { auth, signOut } from "@/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";

export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🐝</span>
            <span className="text-xl font-bold text-primary">Coding Swarm</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Button variant="ghost" asChild>
              <Link href="/">Dashboard</Link>
            </Button>
            {session?.user?.status === "authorized" && (
              <Button variant="ghost" asChild>
                <Link href="/admin/users">Users</Link>
              </Button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session?.user && (
            <>
              <div className="hidden items-center gap-2 md:flex">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session.user.image || undefined} alt={session.user.name || "User"} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {session.user.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  {session.user.name}
                </span>
              </div>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <Button variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
