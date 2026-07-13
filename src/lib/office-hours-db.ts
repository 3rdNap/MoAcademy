// Supabase-backed office-hours booking (migration 0033). Instructors publish
// slots on their course (plain RLS INSERT/DELETE); course-mates book/cancel via
// the book_office_hour / cancel_office_hour SECURITY DEFINER RPCs. Reads are
// RLS-gated to the instructor, the booker, subject-mates and admins. Everything
// degrades to null/false so the widget can fall back to its empty state.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface OfficeHourSlot {
  id: string;
  instructorId: string;
  courseKey: string;
  startsAt: string;
  endsAt: string;
  location: string;
  bookedBy?: string;
  bookedAt?: string;
}

interface OfficeHourSlotRow {
  id: string;
  instructor_id: string;
  course_key: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  booked_by: string | null;
  booked_at: string | null;
}

function mapRow(r: OfficeHourSlotRow): OfficeHourSlot {
  return {
    id: r.id,
    instructorId: r.instructor_id,
    courseKey: r.course_key,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    location: r.location ?? "",
    bookedBy: r.booked_by ?? undefined,
    bookedAt: r.booked_at ?? undefined,
  };
}

// Grace window so a slot that's just started still shows briefly.
function recentCutoff(): string {
  return new Date(Date.now() - 86400000).toISOString();
}

/** Future-or-recent slots for a course, soonest first — or null when offline. */
export async function fetchCourseOfficeHours(
  courseKey: string,
): Promise<OfficeHourSlot[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("office_hour_slots")
      .select("*")
      .eq("course_key", courseKey)
      .gte("starts_at", recentCutoff())
      .order("starts_at");
    if (error || !data) return null;
    return (data as unknown as OfficeHourSlotRow[]).map(mapRow);
  } catch {
    return null;
  }
}

/** Future slots I've booked or (as instructor) own — for the calendar. Null
 *  when offline. */
export async function fetchMyBookedOfficeHours(): Promise<
  OfficeHourSlot[] | null
> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("office_hour_slots")
      .select("*")
      .gte("starts_at", new Date().toISOString())
      .or(`booked_by.eq.${user.id},instructor_id.eq.${user.id}`)
      .order("starts_at");
    if (error || !data) return null;
    return (data as unknown as OfficeHourSlotRow[]).map(mapRow);
  } catch {
    return null;
  }
}

/** Publish a slot (instructor_id = the signed-in account). Null when refused
 *  (not a teaching account) or offline. */
export async function addOfficeHourSlot(
  courseKey: string,
  input: { startsAt: string; endsAt: string; location: string },
): Promise<OfficeHourSlot | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("office_hour_slots")
      .insert({
        instructor_id: user.id,
        course_key: courseKey,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        location: input.location,
      })
      .select()
      .single();
    if (error || !data) return null;
    return mapRow(data as unknown as OfficeHourSlotRow);
  } catch {
    return null;
  }
}

export async function removeOfficeHourSlot(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("office_hour_slots")
      .delete()
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** Book an open slot via the RPC — false on any refusal/error. */
export async function bookOfficeHour(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc("book_office_hour", { slot: id });
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Free a booking via the RPC — false on any refusal/error. */
export async function cancelOfficeHour(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc("cancel_office_hour", {
      slot: id,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Booker display names keyed by profile id — for the instructor view. Empty
 *  map on error (the widget then shows "Booked" without a name). */
export async function fetchProfileNames(
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return {};
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    if (error || !data) return {};
    const out: Record<string, string> = {};
    for (const p of data as { id: string; full_name: string | null }[]) {
      out[p.id] = p.full_name ?? "";
    }
    return out;
  } catch {
    return {};
  }
}
