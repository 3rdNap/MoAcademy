// Supabase-backed submissions and grades (see migration 0019 on top of the
// submissions table from 0001_init.sql). Students upsert their own submission
// row; teaching accounts read/grade the roster for the courses they teach.
// RLS enforces who can see and write what — everything here degrades to
// null/false so callers can fall back to the browser-local stores.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { subjects } from "@/lib/billing/subjects";
import { getClientTerm } from "@/lib/term";
import type { SubmissionStatus } from "@/lib/types";

export interface RemoteSubmission {
  assignmentId: string;
  userId: string;
  status: SubmissionStatus;
  score: number | null;
  body: string;
  fileName?: string;
  filePath?: string;
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
  file_path: string | null;
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
    filePath: r.file_path ?? undefined,
    feedback: r.feedback ?? undefined,
    submittedAt: r.submitted_at ?? undefined,
    gradedAt: r.graded_at ?? undefined,
  };
}

const SUBMISSIONS_BUCKET = "submissions";

/**
 * Upload a submission attachment to the private 'submissions' bucket. The path
 * `<uid>/<assignmentId>/…` matches the storage RLS (owner via segment 1,
 * teaching account via private.teaches_assignment on segment 2). Returns the
 * stored path + display name, or null on any failure so callers fall back to a
 * name-only submission.
 */
export async function uploadSubmissionFile(
  assignmentId: string,
  file: File,
): Promise<{ path: string; name: string } | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    // Object keys reject some characters students commonly use in filenames;
    // the display name (file_name column) keeps the original.
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${assignmentId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage
      .from(SUBMISSIONS_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) return null;
    return { path, name: file.name };
  } catch {
    return null;
  }
}

/** Short-lived signed URL for a submission attachment. Null on any failure. */
export async function getSubmissionFileUrl(path: string): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage
      .from(SUBMISSIONS_BUCKET)
      .createSignedUrl(path, 300);
    if (error || !data) return null;
    return data.signedUrl ?? null;
  } catch {
    return null;
  }
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
  input: { body: string; fileName?: string; filePath?: string },
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
          // Only overwrite the stored path when a new upload happened.
          ...(input.filePath ? { file_path: input.filePath } : {}),
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
    const term = await getClientTerm();
    const { data: enr, error: enrError } = await supabase
      .from("subject_enrollments")
      .select("user_id")
      .eq("subject_code", code)
      .eq("role", "student")
      .eq("term", term);
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

/* ------------------------------- Rubrics -------------------------------- */
// Instructors define criteria (with point values) on a published assignment
// and award points per criterion per student. Criteria are public-read (so
// students see the breakdown); scores follow submission visibility via RLS —
// migration 0031. Everything degrades to null/false like the rest of this file.

export interface RubricCriterion {
  id: string;
  assignmentId: string;
  description: string;
  points: number;
  position: number;
}

export interface RubricScore {
  criterionId: string;
  studentId: string;
  points: number;
}

interface RubricCriterionRow {
  id: string;
  assignment_id: string;
  description: string;
  points: number;
  position: number;
}

interface RubricScoreRow {
  criterion_id: string;
  student_id: string;
  points: number;
}

function mapCriterion(r: RubricCriterionRow): RubricCriterion {
  return {
    id: r.id,
    assignmentId: r.assignment_id,
    description: r.description,
    points: r.points,
    position: r.position,
  };
}

/** Rubric criteria for these assignments, ordered by position. Public read. */
export async function fetchRubrics(
  assignmentIds: string[],
): Promise<RubricCriterion[] | null> {
  if (assignmentIds.length === 0) return null;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("rubric_criteria")
      .select("*")
      .in("assignment_id", assignmentIds)
      .order("position", { ascending: true });
    if (error || !data) return null;
    return (data as unknown as RubricCriterionRow[]).map(mapCriterion);
  } catch {
    return null;
  }
}

/** Add a criterion as the assignment's teaching account. Null when refused. */
export async function addRubricCriterion(
  assignmentId: string,
  input: { description: string; points: number; position: number },
): Promise<RubricCriterion | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("rubric_criteria")
      .insert({
        assignment_id: assignmentId,
        description: input.description,
        points: input.points,
        position: input.position,
      })
      .select()
      .single();
    if (error || !data) return null;
    return mapCriterion(data as unknown as RubricCriterionRow);
  } catch {
    return null;
  }
}

/** Edit a criterion's description/points as the assignment's teaching account. */
export async function updateRubricCriterion(
  id: string,
  patch: { description?: string; points?: number },
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase
      .from("rubric_criteria")
      .update(patch)
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** Delete a criterion (cascades its scores). False when refused. */
export async function removeRubricCriterion(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase
      .from("rubric_criteria")
      .delete()
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** Rubric scores for these criteria, scoped by RLS (own row / taught roster). */
export async function fetchRubricScores(
  criterionIds: string[],
): Promise<RubricScore[] | null> {
  if (criterionIds.length === 0) return null;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("rubric_scores")
      .select("criterion_id, student_id, points")
      .in("criterion_id", criterionIds);
    if (error || !data) return null;
    return (data as unknown as RubricScoreRow[]).map((r) => ({
      criterionId: r.criterion_id,
      studentId: r.student_id,
      points: r.points,
    }));
  } catch {
    return null;
  }
}

/** Award a criterion score for a student as the assignment's teaching account. */
export async function upsertRubricScore(
  criterionId: string,
  studentId: string,
  points: number,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from("rubric_scores").upsert(
      { criterion_id: criterionId, student_id: studentId, points },
      { onConflict: "criterion_id,student_id" },
    );
    return !error;
  } catch {
    return false;
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
