// Supabase-backed study-guide library. When the backend is configured, guides
// live in the shared study_guides table (readable by everyone; writable by
// admins per RLS — see supabase/migrations/0007). Files land in Storage via
// uploadStudyFile; small fallback uploads travel as data URLs in the same
// columns. All functions degrade to null/false so callers can fall back to
// the browser-local library.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StudyGuide } from "@/lib/study-guides";

interface GuideRow {
  id: string;
  title: string;
  subject: string;
  description: string;
  pdf_path: string | null;
  thumb_path: string | null;
  created_at: string;
}

function mapRow(r: GuideRow): StudyGuide {
  const pdf = r.pdf_path ?? undefined;
  const thumb = r.thumb_path ?? undefined;
  return {
    id: r.id,
    title: r.title,
    subject: r.subject,
    description: r.description,
    ...(pdf?.startsWith("data:") ? { pdfData: pdf } : { pdfUrl: pdf }),
    ...(thumb?.startsWith("data:") ? { thumbData: thumb } : { thumbUrl: thumb }),
    createdAt: r.created_at,
  };
}

type GuideInput = Omit<StudyGuide, "id" | "createdAt">;

function toRow(g: GuideInput) {
  return {
    title: g.title,
    subject: g.subject,
    description: g.description,
    pdf_path: g.pdfUrl ?? g.pdfData ?? null,
    thumb_path: g.thumbUrl ?? g.thumbData ?? null,
  };
}

/** All shared guides, newest first — or null if no backend is reachable. */
export async function fetchRemoteGuides(): Promise<StudyGuide[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("study_guides")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data) return null;
    return (data as unknown as GuideRow[]).map(mapRow);
  } catch {
    return null;
  }
}

/** The signed-in user's id, or null when signed out / unconfigured. */
export async function getSignedInUserId(): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/** Publish a guide to the shared library. Null if the write was refused. */
export async function addRemoteGuide(
  input: GuideInput,
): Promise<StudyGuide | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("study_guides")
      .insert({ ...toRow(input), owner_id: user.id })
      .select()
      .single();
    if (error || !data) return null;
    return mapRow(data as unknown as GuideRow);
  } catch {
    return null;
  }
}

export async function updateRemoteGuide(
  id: string,
  input: GuideInput,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("study_guides")
      .update(toRow(input))
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

export async function removeRemoteGuide(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("study_guides").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}
