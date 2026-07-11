// Supabase-backed practice-quiz history (see supabase/migrations/0025).
// Strictly user-owned rows — RLS restricts every read/write to the signed-in
// user. Degrades to null/false so the quiz can fall back to the
// browser-local history.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface RemotePracticeResult {
  id: string;
  topic: string;
  score: number;
  total: number;
  createdAt: string;
}

interface PracticeResultRow {
  id: string;
  topic: string;
  score: number;
  total: number;
  created_at: string;
}

function mapRow(r: PracticeResultRow): RemotePracticeResult {
  return {
    id: r.id,
    topic: r.topic,
    score: r.score,
    total: r.total,
    createdAt: r.created_at,
  };
}

/** The signed-in user's practice history, newest first — or null when signed out/offline. */
export async function fetchMyPracticeHistory(): Promise<
  RemotePracticeResult[] | null
> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("practice_results")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data) return null;
    return (data as unknown as PracticeResultRow[]).map(mapRow);
  } catch {
    return null;
  }
}

/** Record a finished quiz result for the signed-in user. Null if the write was refused. */
export async function addRemotePracticeResult(input: {
  topic: string;
  score: number;
  total: number;
}): Promise<RemotePracticeResult | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("practice_results")
      .insert({
        user_id: user.id,
        topic: input.topic,
        score: input.score,
        total: input.total,
      })
      .select()
      .single();
    if (error || !data) return null;
    return mapRow(data as unknown as PracticeResultRow);
  } catch {
    return null;
  }
}
