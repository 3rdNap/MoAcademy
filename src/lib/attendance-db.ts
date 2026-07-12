// Supabase-backed attendance register (migration 0030). Teaching accounts
// read/write their subject's register; students read only their own rows;
// guardians read their child's. RLS enforces all of this via
// private.teaches_course. Everything degrades to null/false on any error so
// callers can fall back to a friendly empty state.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRecord {
  id: string;
  courseKey: string;
  studentId: string;
  onDate: string; // YYYY-MM-DD
  status: AttendanceStatus;
}

interface AttendanceRow {
  id: string;
  course_key: string;
  student_id: string;
  on_date: string;
  status: AttendanceStatus;
}

function mapRow(r: AttendanceRow): AttendanceRecord {
  return {
    id: r.id,
    courseKey: r.course_key,
    studentId: r.student_id,
    onDate: r.on_date,
    status: r.status,
  };
}

/**
 * Attendance rows for a course. RLS scopes the result: a teaching account gets
 * the whole register; a student gets only their own rows. Null on any failure.
 */
export async function fetchCourseAttendance(
  courseKey: string,
): Promise<AttendanceRecord[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("attendance")
      .select("id, course_key, student_id, on_date, status")
      .eq("course_key", courseKey)
      .order("on_date", { ascending: true });
    if (error || !data) return null;
    return (data as unknown as AttendanceRow[]).map(mapRow);
  } catch {
    return null;
  }
}

/**
 * Mark (or change) one student's status for a date, as a teaching account.
 * Upserts on the (course_key, student_id, on_date) unique key. False on any
 * failure (offline, signed out, or not a teaching account for the course).
 */
export async function setAttendance(
  courseKey: string,
  studentId: string,
  onDate: string,
  status: AttendanceStatus,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from("attendance").upsert(
      {
        course_key: courseKey,
        student_id: studentId,
        on_date: onDate,
        status,
        noted_by: user.id,
      },
      { onConflict: "course_key,student_id,on_date" },
    );
    return !error;
  } catch {
    return false;
  }
}

/** Unmark one student's status for a date (delete the row). False on failure. */
export async function clearAttendance(
  courseKey: string,
  studentId: string,
  onDate: string,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("course_key", courseKey)
      .eq("student_id", studentId)
      .eq("on_date", onDate);
    return !error;
  } catch {
    return false;
  }
}
