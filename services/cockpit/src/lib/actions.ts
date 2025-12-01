"use server";

import { signOut as nextAuthSignOut } from "@/auth";

export async function signOutAction() {
  await nextAuthSignOut({ redirectTo: "/login" });
}
