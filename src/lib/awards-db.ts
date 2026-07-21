// Supabase-backed awards (D2L "Awards" tool, migration 0037). A teaching
// account mints achievement badges for a course it teaches and awards them to
// enrolled students with an optional note; a student reads their own earned
// badges. RLS enforces all of this (badge definitions are readable by any
// signed-in user; management + awarding go through private.teaches_course).
// Everything degrades to null/false on any error so callers fall back to a
// friendly empty state. `courseKey` is the subject id (e.g. sub_math),
// matching course.id.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface Badge {
  id: string;
  courseKey: string | null;
  name: string;
  description: string;
  icon: string;
}

export interface BadgeAward {
  id: string;
  badgeId: string;
  studentId: string;
  note: string;
  awardedAt: string;
}

interface BadgeRow {
  id: string;
  course_key: string | null;
  name: string;
  description: string;
  icon: string;
}

interface AwardRow {
  id: string;
  badge_id: string;
  student_id: string;
  note: string;
  awarded_at: string;
}

function mapBadge(r: BadgeRow): Badge {
  return {
    id: r.id,
    courseKey: r.course_key,
    name: r.name,
    description: r.description,
    icon: r.icon,
  };
}

function mapAward(r: AwardRow): BadgeAward {
  return {
    id: r.id,
    badgeId: r.badge_id,
    studentId: r.student_id,
    note: r.note,
    awardedAt: r.awarded_at,
  };
}

/** Badges defined for a course, oldest first. Public read. Null on failure. */
export async function fetchCourseBadges(
  courseKey: string,
): Promise<Badge[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("badges")
      .select("id, course_key, name, description, icon")
      .eq("course_key", courseKey)
      .order("created_at", { ascending: true });
    if (error || !data) return null;
    return (data as unknown as BadgeRow[]).map(mapBadge);
  } catch {
    return null;
  }
}

/**
 * Awards for this course's badges. The inner join on badges scopes the rows to
 * this course; RLS further scopes teacher (all recipients) vs. student (own).
 * Null on any failure.
 */
export async function fetchCourseAwards(
  courseKey: string,
): Promise<BadgeAward[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("badge_awards")
      .select("id, badge_id, student_id, note, awarded_at, badges!inner(course_key)")
      .eq("badges.course_key", courseKey);
    if (error || !data) return null;
    return (data as unknown as AwardRow[]).map(mapAward);
  } catch {
    return null;
  }
}

/** The signed-in user's own awards joined to their badge definitions. Null on failure. */
export async function fetchMyAwards(): Promise<
  (BadgeAward & { badge: Badge })[] | null
> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("badge_awards")
      .select("*, badges(*)")
      .eq("student_id", user.id)
      .order("awarded_at", { ascending: false });
    if (error || !data) return null;
    return (data as unknown as (AwardRow & { badges: BadgeRow | null })[])
      .filter((r) => r.badges)
      .map((r) => ({ ...mapAward(r), badge: mapBadge(r.badges!) }));
  } catch {
    return null;
  }
}

/** Mint a badge as a teaching account (created_by = auth user). Null on failure. */
export async function createBadge(
  courseKey: string,
  input: { name: string; description: string; icon: string },
): Promise<Badge | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("badges")
      .insert({
        course_key: courseKey,
        name: input.name,
        description: input.description,
        icon: input.icon,
        created_by: user.id,
      })
      .select("id, course_key, name, description, icon")
      .single();
    if (error || !data) return null;
    return mapBadge(data as unknown as BadgeRow);
  } catch {
    return null;
  }
}

/** Delete a badge (awards cascade) as a teaching account. False on failure. */
export async function removeBadge(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("badges").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** Award a badge to a student as a teaching account. False on failure. */
export async function awardBadge(
  badgeId: string,
  studentId: string,
  note: string,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase
      .from("badge_awards")
      .insert({
        badge_id: badgeId,
        student_id: studentId,
        awarded_by: user.id,
        note,
      });
    return !error;
  } catch {
    return false;
  }
}

/** Revoke a student's award for a badge as a teaching account. False on failure. */
export async function revokeAward(
  badgeId: string,
  studentId: string,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("badge_awards")
      .delete()
      .eq("badge_id", badgeId)
      .eq("student_id", studentId);
    return !error;
  } catch {
    return false;
  }
}
