// Supabase-backed guardian reads for the notification bell (migrations 0017
// guardian policies on submissions + 0030 attendance guardian read). A
// signed-in parent sees their linked child's recent grades and absences; RLS
// scopes every query to their own children. Everything degrades to null on any
// error so the bell simply shows nothing guardian-specific.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface ChildGrade {
  studentId: string;
  assignmentTitle: string;
  score: number;
  points: number;
  courseKey: string;
  gradedAt: string;
}

export interface ChildAbsence {
  studentId: string;
  courseKey: string;
  onDate: string; // YYYY-MM-DD
}

// A Supabase to-one embed can come back as a single object or a one-element
// array depending on the relationship inference — normalize both to one row.
function firstEmbed<T>(embed: T | T[] | null | undefined): T | null {
  if (!embed) return null;
  return Array.isArray(embed) ? embed[0] ?? null : embed;
}

interface GradedSubmissionRow {
  user_id: string;
  score: number | null;
  graded_at: string | null;
  assignments:
    | { title: string; points: number; course_key: string | null }
    | { title: string; points: number; course_key: string | null }[]
    | null;
}

interface AttendanceRow {
  student_id: string;
  course_key: string;
  on_date: string;
}

/** The signed-in guardian's linked student ids (guardian_links). Null on error. */
export async function fetchMyChildrenIds(): Promise<string[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("guardian_links")
      .select("student_id")
      .eq("guardian_id", user.id);
    if (error || !data) return null;
    return data.map((l) => l.student_id as string);
  } catch {
    return null;
  }
}

/** Linked children's display names, id → full name. Null on error. */
export async function fetchChildNames(
  childIds: string[],
): Promise<Record<string, string> | null> {
  if (childIds.length === 0) return {};
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", childIds);
    if (error || !data) return null;
    const names: Record<string, string> = {};
    for (const p of data) {
      names[p.id as string] = (p.full_name as string) ?? "";
    }
    return names;
  } catch {
    return null;
  }
}

/** Recent graded submissions for the linked children (last ~14 days), newest
 *  first. RLS (guardian read) scopes the rows. Null on error. */
export async function fetchChildRecentGrades(
  childIds: string[],
): Promise<ChildGrade[] | null> {
  if (childIds.length === 0) return [];
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data, error } = await supabase
      .from("submissions")
      .select("user_id, score, graded_at, assignments(title, points, course_key)")
      .in("user_id", childIds)
      .eq("status", "graded")
      .not("graded_at", "is", null)
      .gte("graded_at", since)
      .order("graded_at", { ascending: false });
    if (error || !data) return null;
    const rows = data as unknown as GradedSubmissionRow[];
    const grades: ChildGrade[] = [];
    for (const r of rows) {
      const a = firstEmbed(r.assignments);
      if (r.score == null || !r.graded_at || !a) continue;
      grades.push({
        studentId: r.user_id,
        assignmentTitle: a.title,
        score: r.score,
        points: a.points,
        courseKey: a.course_key ?? "",
        gradedAt: r.graded_at,
      });
    }
    return grades;
  } catch {
    return null;
  }
}

/** Recent absences for the linked children (last ~14 days), newest first. RLS
 *  (guardian read, migration 0030) scopes the rows. Null on error. */
export async function fetchChildRecentAbsences(
  childIds: string[],
): Promise<ChildAbsence[] | null> {
  if (childIds.length === 0) return [];
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    // on_date is a plain date, so compare against a YYYY-MM-DD cutoff.
    const since = new Date(Date.now() - 14 * 86400000)
      .toISOString()
      .slice(0, 10);
    const { data, error } = await supabase
      .from("attendance")
      .select("student_id, course_key, on_date")
      .in("student_id", childIds)
      .eq("status", "absent")
      .gte("on_date", since)
      .order("on_date", { ascending: false });
    if (error || !data) return null;
    return (data as unknown as AttendanceRow[]).map((r) => ({
      studentId: r.student_id,
      courseKey: r.course_key,
      onDate: r.on_date,
    }));
  } catch {
    return null;
  }
}
