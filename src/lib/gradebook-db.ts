// Supabase-backed submissions and grades (see migration 0019 on top of the
// submissions table from 0001_init.sql). Students upsert their own submission
// row; teaching accounts read/grade the roster for the courses they teach.
// RLS enforces who can see and write what — everything here degrades to
// null/false so callers can fall back to the browser-local stores.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { subjects } from "@/lib/billing/subjects";
import { CURRENT_TERM } from "@/lib/billing/registration";
import type { SubmissionStatus } from "@/lib/types";

export interface RemoteSubmission {
  assignmentId: string;
  userId: string;
  status: SubmissionStatus;
  score: number | null;
  body: string;
  fileName?: string;
  feedback?: string;
  submittedAt?: string;
  gradedAt?: string;
}

interface SubmissionRow {
  assignment_id: string;
  user_id: string;
  status: SubmissionStatus;
  score: number | null;
  body: string;
  file_name: string | null;
  feedback: string | null;
  submitted_at: string | null;
  graded_at: string | null;
}

function mapSubmission(r: SubmissionRow): RemoteSubmission {
  return {
    assignmentId: r.assignment_id,
    userId: r.user_id,
    status: r.status,
    score: r.score,
    body: r.body,
    fileName: r.file_name ?? undefined,
    feedback: r.feedback ?? undefined,
    submittedAt: r.submitted_at ?? undefined,
    gradedAt: r.graded_at ?? undefined,
  };
}

/** The signed-in student's own submissions for these assignments — or null. */
export async function fetchMySubmissions(
  assignmentIds: string[],
): Promise<RemoteSubmission[] | null> {
  if (assignmentIds.length === 0) return null;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("user_id", user.id)
      .in("assignment_id", assignmentIds);
    if (error || !data) return null;
    return (data as unknown as SubmissionRow[]).map(mapSubmission);
  } catch {
    return null;
  }
}

/** Turn in work as the signed-in student. Null when signed out / refused. */
export async function upsertMySubmission(
  assignmentId: string,
  input: { body: string; fileName?: string },
): Promise<RemoteSubmission | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("submissions")
      .upsert(
        {
          assignment_id: assignmentId,
          user_id: user.id,
          status: "submitted",
          body: input.body,
          file_name: input.fileName ?? null,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "assignment_id,user_id" },
      )
      .select()
      .single();
    if (error || !data) return null;
    return mapSubmission(data as unknown as SubmissionRow);
  } catch {
    return null;
  }
}

export interface RosterStudent {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

/**
 * The real enrolled class for a course, for a teaching account. Null when
 * offline / not a teaching account for this course; [] when the caller
 * teaches it but no students are enrolled yet.
 */
export async function fetchCourseRoster(
  courseId: string,
): Promise<RosterStudent[] | null> {
  const code = subjects.find((s) => s.id === courseId)?.code;
  if (!code) return null;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data: enr, error: enrError } = await supabase
      .from("subject_enrollments")
      .select("user_id")
      .eq("subject_code", code)
      .eq("role", "student")
      .eq("term", CURRENT_TERM);
    if (enrError || !enr) return null;
    const ids = enr.map((r) => r.user_id as string);
    if (ids.length === 0) return [];
    const { data: profs, error: profError } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_color")
      .in("id", ids);
    if (profError || !profs) return null;
    return profs.map((p) => ({
      id: p.id as string,
      name: (p.full_name as string) ?? "",
      email: (p.email as string) ?? "",
      avatarColor: (p.avatar_color as string) ?? "#0284c7",
    }));
  } catch {
    return null;
  }
}

/** Submissions for these assignments, scoped by RLS to what the caller teaches. */
export async function fetchCourseSubmissions(
  assignmentIds: string[],
): Promise<RemoteSubmission[] | null> {
  if (assignmentIds.length === 0) return null;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .in("assignment_id", assignmentIds);
    if (error || !data) return null;
    return (data as unknown as SubmissionRow[]).map(mapSubmission);
  } catch {
    return null;
  }
}

/** Grade a student's submission as the signed-in teaching account. */
export async function upsertGrade(
  assignmentId: string,
  studentId: string,
  patch: { score: number | null; feedback?: string },
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    // Upsert (not update): a student with no submission yet has no row to
    // update — grading "missing" work needs to create the placeholder row.
    const { error } = await supabase.from("submissions").upsert(
      {
        assignment_id: assignmentId,
        user_id: studentId,
        score: patch.score,
        feedback: patch.feedback ?? null,
        graded_at: new Date().toISOString(),
        graded_by: user.id,
        status: patch.score != null ? "graded" : "submitted",
      },
      { onConflict: "assignment_id,user_id" },
    );
    return !error;
  } catch {
    return false;
  }
}
