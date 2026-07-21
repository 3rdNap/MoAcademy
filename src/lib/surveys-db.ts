// Supabase-backed course surveys (D2L "Surveys" tool, migration 0038). A
// teaching account authors a survey (rating + free-text questions) for a course
// it teaches; enrolled course-mates respond once through the submit_survey RPC;
// the teacher reads aggregate answers. Anonymous surveys store answers with no
// respondent link (enforced server-side), so aggregation never carries identity.
// Everything degrades to null/false on any error so callers fall back to a
// friendly empty state. `courseKey` is the subject id (e.g. sub_math).

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface Survey {
  id: string;
  courseKey: string;
  title: string;
  description: string;
  anonymous: boolean;
  closesAt?: string;
}

export interface SurveyQuestion {
  id: string;
  surveyId: string;
  position: number;
  prompt: string;
  kind: "rating" | "text";
}

// respondent omitted — answers are read for aggregation only, and anonymous
// answers genuinely carry no identity.
export interface SurveyAnswer {
  questionId: string;
  value: string;
}

interface SurveyRow {
  id: string;
  course_key: string;
  title: string;
  description: string;
  anonymous: boolean;
  closes_at: string | null;
}

interface SurveyQuestionRow {
  id: string;
  survey_id: string;
  position: number;
  prompt: string;
  kind: "rating" | "text";
}

function mapSurvey(r: SurveyRow): Survey {
  return {
    id: r.id,
    courseKey: r.course_key,
    title: r.title,
    description: r.description,
    anonymous: r.anonymous,
    closesAt: r.closes_at ?? undefined,
  };
}

function mapQuestion(r: SurveyQuestionRow): SurveyQuestion {
  return {
    id: r.id,
    surveyId: r.survey_id,
    position: r.position,
    prompt: r.prompt,
    kind: r.kind ?? "rating",
  };
}

/** Surveys for a course, newest first. RLS scopes the result (teaching account
 * or enrolled course-mate). Null on any failure. */
export async function fetchCourseSurveys(
  courseKey: string,
): Promise<Survey[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("surveys")
      .select("id, course_key, title, description, anonymous, closes_at")
      .eq("course_key", courseKey)
      .order("created_at", { ascending: false });
    if (error || !data) return null;
    return (data as unknown as SurveyRow[]).map(mapSurvey);
  } catch {
    return null;
  }
}

/** A survey's questions, ordered by position. Null on any failure. */
export async function fetchSurveyQuestions(
  surveyId: string,
): Promise<SurveyQuestion[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("survey_questions")
      .select("id, survey_id, position, prompt, kind")
      .eq("survey_id", surveyId)
      .order("position", { ascending: true });
    if (error || !data) return null;
    return (data as unknown as SurveyQuestionRow[]).map(mapQuestion);
  } catch {
    return null;
  }
}

/** Survey ids the current user has completed, among the given ids. Null on any
 * failure. */
export async function fetchMyCompletions(
  surveyIds: string[],
): Promise<string[] | null> {
  if (surveyIds.length === 0) return [];
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("survey_completions")
      .select("survey_id")
      .eq("respondent_id", user.id)
      .in("survey_id", surveyIds);
    if (error || !data) return null;
    return (data as { survey_id: string }[]).map((r) => r.survey_id);
  } catch {
    return null;
  }
}

/** Answers for a survey, for teacher aggregation. RLS returns every answer to a
 * teaching account; a student gets only their own (none on anonymous surveys).
 * Null on any failure. */
export async function fetchSurveyAnswers(
  surveyId: string,
): Promise<SurveyAnswer[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("survey_answers")
      .select("question_id, value")
      .eq("survey_id", surveyId);
    if (error || !data) return null;
    return (data as { question_id: string; value: string }[]).map((r) => ({
      questionId: r.question_id,
      value: r.value,
    }));
  } catch {
    return null;
  }
}

/** How many respondents have completed a survey. RLS scopes this (teacher sees
 * all; a student sees only their own row). Null on any failure. */
export async function fetchSurveyCompletionCount(
  surveyId: string,
): Promise<number | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { count, error } = await supabase
      .from("survey_completions")
      .select("*", { count: "exact", head: true })
      .eq("survey_id", surveyId);
    if (error || count === null) return null;
    return count;
  } catch {
    return null;
  }
}

/** Create a survey as a teaching account (created_by = auth user). Null on
 * failure. */
export async function createSurvey(
  courseKey: string,
  input: {
    title: string;
    description: string;
    anonymous: boolean;
    closesAt?: string;
  },
): Promise<Survey | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("surveys")
      .insert({
        course_key: courseKey,
        title: input.title,
        description: input.description,
        anonymous: input.anonymous,
        closes_at: input.closesAt ?? null,
        created_by: user.id,
      })
      .select("id, course_key, title, description, anonymous, closes_at")
      .single();
    if (error || !data) return null;
    return mapSurvey(data as unknown as SurveyRow);
  } catch {
    return null;
  }
}

/** Delete a survey (questions, answers, completions cascade) as a teaching
 * account. False on failure. */
export async function removeSurvey(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("surveys").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** Add a question to a survey as a teaching account. Null on failure. */
export async function addSurveyQuestion(
  surveyId: string,
  input: { prompt: string; kind: "rating" | "text"; position: number },
): Promise<SurveyQuestion | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("survey_questions")
      .insert({
        survey_id: surveyId,
        prompt: input.prompt,
        kind: input.kind,
        position: input.position,
      })
      .select("id, survey_id, position, prompt, kind")
      .single();
    if (error || !data) return null;
    return mapQuestion(data as unknown as SurveyQuestionRow);
  } catch {
    return null;
  }
}

/** Delete a question (its answers cascade) as a teaching account. False on
 * failure. */
export async function removeSurveyQuestion(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("survey_questions")
      .delete()
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** Submit a survey response through the server RPC. The answer map is keyed by
 * question id; the RPC enforces one response per student and honours anonymity.
 * False on any error (e.g. already responded, not enrolled). */
export async function submitSurvey(
  surveyId: string,
  answers: Record<string, string>,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc("submit_survey", {
      sid: surveyId,
      answer_map: answers,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}
