// Browser-side read of the institution's active term (app_settings, migration
// 0029, key 'current_term'). Memoized at module scope so repeated calls within
// a page load reuse the same fetch instead of round-tripping every time.
// Falls back to CURRENT_TERM on any error/absence/missing backend.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CURRENT_TERM } from "@/lib/billing/registration";

let termPromise: Promise<string> | null = null;

async function fetchTerm(): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return CURRENT_TERM;
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "current_term")
      .maybeSingle();
    return (data?.value as string) ?? CURRENT_TERM;
  } catch {
    return CURRENT_TERM;
  }
}

/** The institution's active term, fetched once per page load. */
export function getClientTerm(): Promise<string> {
  if (!termPromise) termPromise = fetchTerm();
  return termPromise;
}
