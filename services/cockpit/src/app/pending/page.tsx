import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function PendingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // If user is authorized, redirect to dashboard
  if (session.user.status === "authorized") {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950">
      <div className="w-full max-w-md space-y-8 px-4 text-center">
        <div>
          <span className="text-6xl">⏳</span>
          <h1 className="mt-6 text-3xl font-bold text-white">
            Awaiting Authorization
          </h1>
          <p className="mt-4 text-zinc-400">
            Your account has been registered but is not yet authorized to access
            the Coding Swarm Cockpit.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-4">
            {session.user.image && (
              <img
                src={session.user.image}
                alt={session.user.name || "User"}
                className="h-12 w-12 rounded-full"
              />
            )}
            <div className="text-left">
              <p className="font-medium text-white">{session.user.name}</p>
              <p className="text-sm text-zinc-500">{session.user.email}</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-zinc-500">
          An administrator will review your request and grant access. You will
          be able to access the dashboard once authorized.
        </p>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
          >
            Sign out and try another account
          </button>
        </form>
      </div>
    </div>
  );
}
