// Supabase-backed module item completion (migration 0023). Rows are strictly
// user-owned; a row's existence means the item is complete for that user.
// Only real remote module items (uuid ids) can be tracked here — seed/local
// items never reach this table. Everything degrades to null/false so callers
// can fall back to the browser-local progress store.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Completed item ids for the signed-in user — or null when signed out/offline. */
export async function fetchMyItemProgress(): Promise<string[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("module_item_progress")
      .select("item_id")
      .eq("user_id", user.id);
    if (error || !data) return null;
    return (data as unknown as { item_id: string }[]).map((r) => r.item_id);
  } catch {
    return null;
  }
}

/** Mark an item complete/incomplete for the signed-in user. */
export async function setItemComplete(
  itemId: string,
  complete: boolean,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    if (complete) {
      const { error } = await supabase
        .from("module_item_progress")
        .upsert(
          { user_id: user.id, item_id: itemId },
          { onConflict: "user_id,item_id" },
        );
      return !error;
    }
    const { error } = await supabase
      .from("module_item_progress")
      .delete()
      .eq("user_id", user.id)
      .eq("item_id", itemId);
    return !error;
  } catch {
    return false;
  }
}
