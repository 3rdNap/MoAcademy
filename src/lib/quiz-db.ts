// Supabase-backed structured quizzes (migration 0032). Instructors author
// multiple-choice questions on a quiz-type assignment; answer keys live in a
// separate teacher-only table (students can never read them); attempts are
// written only through the submit_quiz_attempt RPC and auto-graded server-side.
// Everything degrades to null/false so callers can fall back to the local demo.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// An answer map value is a chosen option index (MCQ) or free text (written).
export type QuizAnswer = number | string;

export interface QuizQuestion {
  id: string;
  assignmentId: string;
  position: number;
  prompt: string;
  options: string[];
  points: number;
  kind: "mcq" | "written";
}

export interface QuizAttempt {
  id: string;
  assignmentId: string;
  studentId: string;
  submittedAt: string;
  score: number;
  total: number;
  answers: Record<string, QuizAnswer>;
  attemptNo: number;
}

interface QuizQuestionRow {
  id: string;
  assignment_id: string;
  position: number;
  prompt: string;
  options: string[];
  points: number;
  kind: "mcq" | "written";
}

interface QuizAttemptRow {
  id: string;
  assignment_id: string;
  student_id: string;
  submitted_at: string;
  score: number;
  total: number;
  answers: Record<string, QuizAnswer> | null;
  attempt_no: number;
}

function mapQuestion(r: QuizQuestionRow): QuizQuestion {
  return {
    id: r.id,
    assignmentId: r.assignment_id,
    position: r.position,
    prompt: r.prompt,
    options: r.options ?? [],
    points: r.points,
    kind: r.kind ?? "mcq",
  };
}

function mapAttempt(r: QuizAttemptRow): QuizAttempt {
  return {
    id: r.id,
    assignmentId: r.assignment_id,
    studentId: r.student_id,
    submittedAt: r.submitted_at,
    score: r.score,
    total: r.total,
    answers: r.answers ?? {},
    attemptNo: r.attempt_no ?? 1,
  };
}

/** Questions for these assignments, ordered by position. Public read (works
 * for students too — no answer keys here). Null on any failure. */
export async function fetchQuizQuestions(
  assignmentIds: string[],
): Promise<QuizQuestion[] | null> {
  if (assignmentIds.length === 0) return null;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("quiz_questions")
      .select("*")
      .in("assignment_id", assignmentIds)
      .order("position", { ascending: true });
    if (error || !data) return null;
    return (data as unknown as QuizQuestionRow[]).map(mapQuestion);
  } catch {
    return null;
  }
}

/** Answer keys (question_id → correct_index) for these questions. RLS scopes
 * this to the assignment's teachers; students get an error/empty result, which
 * callers should treat as "not available". Null on failure. */
export async function fetchAnswerKeys(
  questionIds: string[],
): Promise<Record<string, number> | null> {
  if (questionIds.length === 0) return null;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("quiz_answer_keys")
      .select("question_id, correct_index")
      .in("question_id", questionIds);
    if (error || !data) return null;
    return Object.fromEntries(
      (data as { question_id: string; correct_index: number }[]).map((r) => [
        r.question_id,
        r.correct_index,
      ]),
    );
  } catch {
    return null;
  }
}

export interface QuizSource {
  assignmentId: string;
  title: string;
  courseKey: string;
  count: number;
}

/** Discover other quizzes the instructor can import from: every assignment
 * that has quiz_questions (embedding its title + course), grouped and counted,
 * minus the current one. quiz_questions are publicly readable, so the caller
 * must still gate teachability by probing fetchAnswerKeys at import time. Null
 * on any failure. */
export async function fetchMyQuizSources(
  excludeAssignmentId: string,
): Promise<QuizSource[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("quiz_questions")
      .select("assignment_id, assignments(title, course_key)");
    if (error || !data) return null;
    type Row = {
      assignment_id: string;
      // PostgREST types a to-one embed as an array in the generated shape.
      assignments: { title: string; course_key: string } | { title: string; course_key: string }[] | null;
    };
    const byAssignment = new Map<string, QuizSource>();
    for (const r of data as unknown as Row[]) {
      if (r.assignment_id === excludeAssignmentId) continue;
      const embed = Array.isArray(r.assignments) ? r.assignments[0] : r.assignments;
      if (!embed) continue;
      const existing = byAssignment.get(r.assignment_id);
      if (existing) existing.count += 1;
      else
        byAssignment.set(r.assignment_id, {
          assignmentId: r.assignment_id,
          title: embed.title,
          courseKey: embed.course_key,
          count: 1,
        });
    }
    return [...byAssignment.values()].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
  } catch {
    return null;
  }
}

/** Add a question, then (for MCQ) its answer key, as the assignment's teaching
 * account. Written questions carry no options and no key — they're free-text
 * answers a teacher grades. If an MCQ key write fails the question is rolled
 * back so no keyless MCQ is left behind. Null when refused. */
export async function addQuizQuestion(
  assignmentId: string,
  input: {
    prompt: string;
    options: string[];
    correctIndex: number;
    points: number;
    position: number;
    kind: "mcq" | "written";
  },
): Promise<QuizQuestion | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const written = input.kind === "written";
    const { data, error } = await supabase
      .from("quiz_questions")
      .insert({
        assignment_id: assignmentId,
        prompt: input.prompt,
        options: written ? [] : input.options,
        points: input.points,
        position: input.position,
        kind: input.kind,
      })
      .select()
      .single();
    if (error || !data) return null;
    const question = mapQuestion(data as unknown as QuizQuestionRow);
    if (written) return question; // no answer key for free-text questions
    const { error: keyError } = await supabase
      .from("quiz_answer_keys")
      .insert({ question_id: question.id, correct_index: input.correctIndex });
    if (keyError) {
      // Don't leave a keyless (ungradable) MCQ behind.
      await supabase.from("quiz_questions").delete().eq("id", question.id);
      return null;
    }
    return question;
  } catch {
    return null;
  }
}

/** Edit a question's fields; when correctIndex is present, upsert its key.
 * False when refused. */
export async function updateQuizQuestion(
  id: string,
  patch: {
    prompt?: string;
    options?: string[];
    points?: number;
    correctIndex?: number;
  },
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const fields: Record<string, unknown> = {};
    if (patch.prompt !== undefined) fields.prompt = patch.prompt;
    if (patch.options !== undefined) fields.options = patch.options;
    if (patch.points !== undefined) fields.points = patch.points;
    if (Object.keys(fields).length > 0) {
      const { error } = await supabase
        .from("quiz_questions")
        .update(fields)
        .eq("id", id);
      if (error) return false;
    }
    if (patch.correctIndex !== undefined) {
      const { error } = await supabase
        .from("quiz_answer_keys")
        .upsert(
          { question_id: id, correct_index: patch.correctIndex },
          { onConflict: "question_id" },
        );
      if (error) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Delete a question (its key cascades). False when refused. */
export async function removeQuizQuestion(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase
      .from("quiz_questions")
      .delete()
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** The signed-in student's own attempts for these assignments — every attempt
 * now (multiple allowed, migration 0035), ordered by attempt number. */
export async function fetchMyAttempts(
  assignmentIds: string[],
): Promise<QuizAttempt[] | null> {
  if (assignmentIds.length === 0) return null;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select("*")
      .eq("student_id", user.id)
      .in("assignment_id", assignmentIds)
      .order("attempt_no", { ascending: true });
    if (error || !data) return null;
    return (data as unknown as QuizAttemptRow[]).map(mapAttempt);
  } catch {
    return null;
  }
}

/** Attempts for these assignments, scoped by RLS to what the caller teaches. */
export async function fetchAttemptsForAssignments(
  assignmentIds: string[],
): Promise<QuizAttempt[] | null> {
  if (assignmentIds.length === 0) return null;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select("*")
      .in("assignment_id", assignmentIds);
    if (error || !data) return null;
    return (data as unknown as QuizAttemptRow[]).map(mapAttempt);
  } catch {
    return null;
  }
}

export interface QuizAttemptResult {
  earned: number; // auto-graded MCQ points earned this attempt
  total: number; // auto-gradable MCQ points
  writtenTotal: number; // points awaiting teacher grading
  pendingWritten: boolean; // written questions exist → teacher finishes grading
  score: number | null; // final scaled score; null while written is pending
  points: number; // assignment points
  correct: string[]; // ids of MCQ answered correctly this attempt
  attemptNo: number; // this attempt's number
  attemptsAllowed: number;
}

/** Submit and auto-grade a quiz attempt via the server RPC. MCQ keys never
 * leave the database; written answers are stored for the teacher. The answer
 * map holds option indexes (MCQ) or free text (written), keyed by question id.
 * Null on any error (e.g. no attempts left). */
export async function submitQuizAttempt(
  assignmentId: string,
  answers: Record<string, QuizAnswer>,
): Promise<QuizAttemptResult | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("submit_quiz_attempt", {
      aid: assignmentId,
      answer_map: answers,
    });
    if (error || !data) return null;
    return data as QuizAttemptResult;
  } catch {
    return null;
  }
}
