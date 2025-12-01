import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Server-side client with service role (for protected operations)
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Debug: Check if env vars are loaded
  if (!url || !key) {
    console.error("Supabase env vars missing:", {
      url: url ? "SET" : "MISSING",
      key: key ? "SET" : "MISSING",
    });
  }

  return createClient<Database>(url || "", key || "");
}

// Untyped client for tables not yet in the generated types (conversations, messages)
// This allows us to use new tables without regenerating Supabase types
export function createUntypedServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url || "", key || "");
}

export function createUntypedClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey);
}
