import { auth } from "@/auth";
import { Header } from "@/components/Header";
import { createServerClient } from "@/lib/supabase";
import type { CockpitUser } from "@/lib/database.types";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, CheckCircle, XCircle, Clock, Ban } from "lucide-react";

export const dynamic = "force-dynamic";

async function getUsers(): Promise<CockpitUser[]> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users, error } = await (supabase.from("cockpit_users") as any)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching users:", error);
    return [];
  }

  return (users as CockpitUser[]) || [];
}

async function updateUserStatus(formData: FormData) {
  "use server";

  const userId = formData.get("userId") as string;
  const newStatus = formData.get("status") as "authorized" | "blocked";
  const session = await auth();

  if (!session?.user?.id) return;

  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("cockpit_users") as any)
    .update({
      status: newStatus,
      authorized_by: newStatus === "authorized" ? session.user.id : null,
      authorized_at:
        newStatus === "authorized" ? new Date().toISOString() : null,
    })
    .eq("id", userId);

  revalidatePath("/admin/users");
}

function getStatusBadge(status: CockpitUser["status"]) {
  switch (status) {
    case "authorized":
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Authorized
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    case "blocked":
      return (
        <Badge variant="destructive" className="gap-1">
          <Ban className="h-3 w-3" />
          Blocked
        </Badge>
      );
  }
}

export default async function AdminUsersPage() {
  const users = await getUsers();
  const pendingUsers = users.filter((u) => u.status === "pending");
  const authorizedUsers = users.filter((u) => u.status === "authorized");
  const blockedUsers = users.filter((u) => u.status === "blocked");

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>

          <h1 className="mb-8 text-2xl font-bold text-foreground">User Management</h1>

          {/* Pending Users */}
          {pendingUsers.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary">
                <Clock className="h-5 w-5" />
                Pending Approval ({pendingUsers.length})
              </h2>
              <div className="space-y-3">
                {pendingUsers.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onUpdateStatus={updateUserStatus}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Authorized Users */}
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Authorized Users ({authorizedUsers.length})
            </h2>
            {authorizedUsers.length === 0 ? (
              <p className="text-muted-foreground">No authorized users yet.</p>
            ) : (
              <div className="space-y-3">
                {authorizedUsers.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onUpdateStatus={updateUserStatus}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Blocked Users */}
          {blockedUsers.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-destructive">
                <Ban className="h-5 w-5" />
                Blocked Users ({blockedUsers.length})
              </h2>
              <div className="space-y-3">
                {blockedUsers.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onUpdateStatus={updateUserStatus}
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

function UserCard({
  user,
  onUpdateStatus,
}: {
  user: CockpitUser;
  onUpdateStatus: (formData: FormData) => Promise<void>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.avatar_url || undefined} alt={user.name || "User"} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {user.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{user.name || "Unknown"}</span>
              {getStatusBadge(user.status)}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{user.email}</span>
              {user.github_username && (
                <>
                  <span>•</span>
                  <span>@{user.github_username}</span>
                </>
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Joined {new Date(user.created_at).toLocaleDateString()}
              {user.last_login && (
                <> • Last login {new Date(user.last_login).toLocaleDateString()}</>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {user.status !== "authorized" && (
            <form action={onUpdateStatus}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="status" value="authorized" />
              <Button type="submit" size="sm">
                Authorize
              </Button>
            </form>
          )}
          {user.status !== "blocked" && (
            <form action={onUpdateStatus}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="status" value="blocked" />
              <Button type="submit" variant="outline" size="sm" className="text-destructive hover:text-destructive">
                Block
              </Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
