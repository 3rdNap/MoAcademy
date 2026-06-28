import { createBrowserClient } from "@supabase/ssr";
import { hasSupabaseEnv, supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Browser Supabase client. Returns null when Supabase is not configured.
 */
export function createSupabaseBrowserClient() {
  if (!hasSupabaseEnv()) return null;
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
