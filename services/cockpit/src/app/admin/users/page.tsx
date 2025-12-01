import { auth } from "@/auth";
import { Header } from "@/components/Header";
import { createServerClient } from "@/lib/supabase";
import type { CockpitUser } from "@/lib/database.types";
import { revalidatePath } from "next/cache";
import Link from "next/link";

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
        <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs text-green-400">
          Authorized
        </span>
      );
    case "pending":
      return (
        <span className="rounded-full bg-yellow-500/20 px-2 py-1 text-xs text-yellow-400">
          Pending
        </span>
      );
    case "blocked":
      return (
        <span className="rounded-full bg-red-500/20 px-2 py-1 text-xs text-red-400">
          Blocked
        </span>
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
            <Link
              href="/"
              className="text-sm text-zinc-400 transition-colors hover:text-white"
            >
              &larr; Back to Dashboard
            </Link>
          </div>

          <h1 className="mb-8 text-2xl font-bold text-white">User Management</h1>

          {/* Pending Users */}
          {pendingUsers.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-yellow-400">
                <span>⏳</span> Pending Approval ({pendingUsers.length})
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
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-green-400">
              <span>✅</span> Authorized Users ({authorizedUsers.length})
            </h2>
            {authorizedUsers.length === 0 ? (
              <p className="text-zinc-500">No authorized users yet.</p>
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
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-red-400">
                <span>🚫</span> Blocked Users ({blockedUsers.length})
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
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-4">
        {user.avatar_url && (
          <img
            src={user.avatar_url}
            alt={user.name || "User"}
            className="h-10 w-10 rounded-full"
          />
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{user.name || "Unknown"}</span>
            {getStatusBadge(user.status)}
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span>{user.email}</span>
            {user.github_username && (
              <>
                <span>•</span>
                <span>@{user.github_username}</span>
              </>
            )}
          </div>
          <div className="mt-1 text-xs text-zinc-600">
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
            <button
              type="submit"
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              Authorize
            </button>
          </form>
        )}
        {user.status !== "blocked" && (
          <form action={onUpdateStatus}>
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="status" value="blocked" />
            <button
              type="submit"
              className="rounded-lg bg-red-600/20 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-600/30"
            >
              Block
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
