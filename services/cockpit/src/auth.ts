import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { createServerClient } from "@/lib/supabase";
import type { CockpitUser } from "@/lib/database.types";

// Seed users that are automatically authorized
const SEED_EMAILS = [
  "tobias.waggoner@gmail.com",
  "tobias.waggoner@netzalist.de",
];

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      status: "pending" | "authorized" | "blocked";
      githubId: string;
    };
  }
}

// Helper to get cockpit_users table with proper typing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cockpitUsersTable(supabase: ReturnType<typeof createServerClient>): any {
  return supabase.from("cockpit_users");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "github" || !profile) {
        return false;
      }

      const supabase = createServerClient();
      const githubId = String(profile.id);
      const email = user.email;
      const isSeedUser = email && SEED_EMAILS.includes(email.toLowerCase());

      // Check if user exists
      const { data: existingUser } = await cockpitUsersTable(supabase)
        .select("*")
        .eq("github_id", githubId)
        .single();

      if (existingUser) {
        // Update last login
        await cockpitUsersTable(supabase)
          .update({
            last_login: new Date().toISOString(),
            email: email,
            name: user.name,
            avatar_url: user.image,
            github_username: profile.login as string,
          })
          .eq("github_id", githubId);

        // Block blocked users
        if ((existingUser as CockpitUser).status === "blocked") {
          return false;
        }
      } else {
        // Create new user
        const newUser = {
          github_id: githubId,
          github_username: profile.login as string,
          email: email,
          name: user.name,
          avatar_url: user.image,
          status: isSeedUser ? "authorized" : "pending",
          authorized_at: isSeedUser ? new Date().toISOString() : null,
        };

        await cockpitUsersTable(supabase).insert(newUser);
      }

      return true;
    },

    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.githubId = String(profile.id);
      }
      return token;
    },

    async session({ session, token }) {
      if (token.githubId) {
        const supabase = createServerClient();
        const { data: dbUser } = await cockpitUsersTable(supabase)
          .select("*")
          .eq("github_id", token.githubId as string)
          .single();

        if (dbUser) {
          const cockpitUser = dbUser as CockpitUser;
          session.user.id = cockpitUser.id;
          session.user.status = cockpitUser.status;
          session.user.githubId = cockpitUser.github_id;
        }
      }
      return session;
    },

    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");
      const isOnPending = nextUrl.pathname.startsWith("/pending");
      const userStatus = auth?.user?.status;

      // Login page logic
      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }

      // Must be logged in for all other pages
      if (!isLoggedIn) {
        return false;
      }

      // Pending users can only see the pending page
      if (userStatus === "pending") {
        if (isOnPending) return true;
        return Response.redirect(new URL("/pending", nextUrl));
      }

      // Blocked users are redirected to login
      if (userStatus === "blocked") {
        return Response.redirect(new URL("/login?error=blocked", nextUrl));
      }

      // Authorized users can access everything
      return true;
    },
  },
});
