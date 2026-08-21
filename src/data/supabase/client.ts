import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | undefined;

export function requireSupabaseEnv(): { url: string; publishableKey: string } {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("VITE_SUPABASE_URL não foi configurada.");
  if (!publishableKey) throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY não foi configurada.");

  return { url, publishableKey };
}

/** Lazily creates the browser client after validating its public configuration. */
export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;

  const { url, publishableKey } = requireSupabaseEnv();
  client = createClient<Database>(url, publishableKey);
  return client;
}

/**
 * Shared browser-client contract. The proxy defers configuration validation
 * until the client is used, keeping module imports testable without env vars.
 */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, property) {
    const value = Reflect.get(getSupabase(), property);
    return typeof value === "function" ? value.bind(getSupabase()) : value;
  },
});
