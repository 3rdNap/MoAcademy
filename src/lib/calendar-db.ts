// Supabase-backed personal calendar events (see supabase/migrations/0025).
// Strictly user-owned rows — RLS restricts every read/write to the signed-in
// user. Degrades to null/false so the board can fall back to the
// browser-local personal calendar.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CalendarEvent } from "@/lib/types";

interface CalendarEventRow {
  id: string;
  course_id: string | null;
  title: string;
  at: string;
  type: CalendarEvent["type"];
}

function mapRow(r: CalendarEventRow): CalendarEvent {
  return {
    id: r.id,
    courseId: r.course_id ?? undefined,
    title: r.title,
    at: r.at,
    type: r.type,
  };
}

/** The signed-in user's personal calendar events, ordered by time — or null when signed out/offline. */
export async function fetchMyCalendarEvents(): Promise<CalendarEvent[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .order("at");
    if (error || !data) return null;
    return (data as unknown as CalendarEventRow[]).map(mapRow);
  } catch {
    return null;
  }
}

/** Add a personal calendar event for the signed-in user. Null if the write was refused. */
export async function addRemoteCalendarEvent(
  input: Omit<CalendarEvent, "id">,
): Promise<CalendarEvent | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        user_id: user.id,
        course_id: input.courseId ?? null,
        title: input.title,
        at: input.at,
        type: input.type,
      })
      .select()
      .single();
    if (error || !data) return null;
    return mapRow(data as unknown as CalendarEventRow);
  } catch {
    return null;
  }
}

export async function removeRemoteCalendarEvent(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}
