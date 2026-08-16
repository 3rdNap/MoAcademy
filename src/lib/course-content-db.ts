// Supabase-backed instructor-authored course content. Authored rows reference
// the app's course via course_key (text) since demo courses live in seed data
// with text ids; see supabase/migrations/0010. Reads are public, writes need
// a teaching role per RLS. Everything degrades to null/false so callers can
// fall back to the browser-local authoring store.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Announcement,
  Assignment,
  CourseModule,
  ModuleItem,
} from "@/lib/types";

interface AnnouncementRow {
  id: string;
  course_key: string | null;
  course_id: string | null;
  title: string;
  author: string;
  body: string;
  posted_at: string;
}

function mapRow(r: AnnouncementRow): Announcement {
  return {
    id: r.id,
    courseId: r.course_key ?? r.course_id ?? "",
    title: r.title,
    author: r.author,
    body: r.body,
    postedAt: r.posted_at,
  };
}

/** Shared announcements for a course, newest first — or null when offline. */
export async function fetchRemoteAnnouncements(
  courseKey: string,
): Promise<Announcement[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("course_key", courseKey)
      .order("posted_at", { ascending: false });
    if (error || !data) return null;
    return (data as unknown as AnnouncementRow[]).map(mapRow);
  } catch {
    return null;
  }
}

/** Publish an announcement. Null when refused (not a teaching account). */
export async function addRemoteAnnouncement(input: {
  courseKey: string;
  title: string;
  author: string;
  body: string;
}): Promise<Announcement | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        course_key: input.courseKey,
        title: input.title,
        author: input.author,
        body: input.body,
      })
      .select()
      .single();
    if (error || !data) return null;
    return mapRow(data as unknown as AnnouncementRow);
  } catch {
    return null;
  }
}

export async function updateRemoteAnnouncement(
  id: string,
  patch: { title: string; author: string; body: string },
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("announcements")
      .update(patch)
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

export async function removeRemoteAnnouncement(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/* ------------------------------ assignments ----------------------------- */

interface AssignmentRow {
  id: string;
  course_key: string | null;
  course_id: string | null;
  title: string;
  type: Assignment["type"];
  description: string;
  due_at: string;
  available_at: string | null;
  points: number;
}

function mapAssignmentRow(r: AssignmentRow): Assignment {
  return {
    id: r.id,
    courseId: r.course_key ?? r.course_id ?? "",
    title: r.title,
    type: r.type,
    description: r.description,
    dueAt: r.due_at,
    availableAt: r.available_at ?? undefined,
    points: r.points,
    status: "not_started",
  };
}

export interface AssignmentInput {
  title: string;
  type: Assignment["type"];
  description: string;
  dueAt: string;
  points: number;
}

function toAssignmentRow(input: AssignmentInput) {
  return {
    title: input.title,
    type: input.type,
    description: input.description,
    due_at: input.dueAt,
    points: input.points,
  };
}

/** Shared assignments for a course, soonest first — or null when offline. */
export async function fetchRemoteAssignments(
  courseKey: string,
): Promise<Assignment[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("assignments")
      .select("*")
      .eq("course_key", courseKey)
      .order("due_at");
    if (error || !data) return null;
    return (data as unknown as AssignmentRow[]).map(mapAssignmentRow);
  } catch {
    return null;
  }
}

/** Publish an assignment. Null when refused (not a teaching account). */
export async function addRemoteAssignment(
  courseKey: string,
  input: AssignmentInput,
): Promise<Assignment | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("assignments")
      .insert({ course_key: courseKey, ...toAssignmentRow(input) })
      .select()
      .single();
    if (error || !data) return null;
    return mapAssignmentRow(data as unknown as AssignmentRow);
  } catch {
    return null;
  }
}

export async function updateRemoteAssignment(
  id: string,
  input: AssignmentInput,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("assignments")
      .update(toAssignmentRow(input))
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

export async function removeRemoteAssignment(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/* -------------------------------- modules ------------------------------- */

interface ModuleItemRow {
  id: string;
  module_id: string;
  title: string;
  type: ModuleItem["type"];
  position: number;
  due_at: string | null;
  duration_min: number | null;
  indent: number | null;
}

interface ModuleRow {
  id: string;
  course_key: string | null;
  course_id: string | null;
  title: string;
  position: number;
  published: boolean;
  module_items: ModuleItemRow[] | null;
}

function mapItemRow(r: ModuleItemRow): ModuleItem {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    dueAt: r.due_at ?? undefined,
    durationMin: r.duration_min ?? undefined,
    indent: r.indent ?? undefined,
    completed: false,
  };
}

function mapModuleRow(r: ModuleRow): CourseModule {
  return {
    id: r.id,
    courseId: r.course_key ?? r.course_id ?? "",
    title: r.title,
    published: r.published,
    items: (r.module_items ?? [])
      .sort((a, b) => a.position - b.position)
      .map(mapItemRow),
  };
}

/** Shared modules (with items) for a course — or null when offline. */
export async function fetchRemoteModules(
  courseKey: string,
): Promise<CourseModule[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("modules")
      .select("*, module_items(*)")
      .eq("course_key", courseKey)
      .order("position");
    if (error || !data) return null;
    return (data as unknown as ModuleRow[]).map(mapModuleRow);
  } catch {
    return null;
  }
}

/** Publish a module. Null when refused (not a teaching account). */
export async function addRemoteModule(
  courseKey: string,
  title: string,
  published: boolean,
): Promise<CourseModule | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("modules")
      .insert({ course_key: courseKey, title, published })
      .select()
      .single();
    if (error || !data) return null;
    return mapModuleRow({ ...(data as unknown as ModuleRow), module_items: [] });
  } catch {
    return null;
  }
}

export async function setRemoteModulePublished(
  id: string,
  published: boolean,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("modules")
      .update({ published })
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

export async function removeRemoteModule(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("modules").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** Add an item to a shared module. Null when refused. */
export async function addRemoteModuleItem(
  moduleId: string,
  input: { title: string; type: ModuleItem["type"]; position: number },
): Promise<ModuleItem | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("module_items")
      .insert({
        module_id: moduleId,
        title: input.title,
        type: input.type,
        position: input.position,
      })
      .select()
      .single();
    if (error || !data) return null;
    return mapItemRow(data as unknown as ModuleItemRow);
  } catch {
    return null;
  }
}

export async function removeRemoteModuleItem(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("module_items").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** Announcements published in the last `days` across all courses — for the
 * notification bell. Null when offline. */
export async function fetchRecentRemoteAnnouncements(
  days = 7,
): Promise<Announcement[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .gte("posted_at", since)
      .order("posted_at", { ascending: false })
      .limit(10);
    if (error || !data) return null;
    return (data as unknown as Parameters<typeof mapRow>[0][]).map(mapRow);
  } catch {
    return null;
  }
}

/* ------------------------------ submissions ------------------------------ */

export interface RemoteSubmission {
  assignmentId: string;
  status: "not_started" | "in_progress" | "submitted" | "graded" | "late" | "missing";
  score: number | null;
  submittedAt: string | null;
  body: string;
  attachmentName: string | null;
}

interface SubmissionRow {
  assignment_id: string;
  status: RemoteSubmission["status"];
  score: number | null;
  submitted_at: string | null;
  body: string | null;
  attachment_name: string | null;
}

const mapSubmissionRow = (r: SubmissionRow): RemoteSubmission => ({
  assignmentId: r.assignment_id,
  status: r.status ?? "not_started",
  score: r.score,
  submittedAt: r.submitted_at,
  body: r.body ?? "",
  attachmentName: r.attachment_name,
});

/**
 * The signed-in student's own submissions for a set of assignments. Null when
 * offline or before migration 0020, which tells the board to keep using its
 * local copy rather than wrongly showing everything as un-submitted.
 */
export async function fetchMySubmissions(
  assignmentIds: string[],
): Promise<RemoteSubmission[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase || assignmentIds.length === 0) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("submissions")
      .select("assignment_id, status, score, submitted_at, body, attachment_name")
      .eq("user_id", user.id)
      .in("assignment_id", assignmentIds);
    if (error || !data) return null;
    return (data as unknown as SubmissionRow[]).map(mapSubmissionRow);
  } catch {
    return null;
  }
}

/**
 * Hand work in (or revise it) for one assignment, so it is visible on every
 * device — to the student, to whoever teaches them, and to a linked guardian.
 * Null when refused: not signed in, already graded, or not yet migrated.
 */
export async function saveMySubmission(input: {
  assignmentId: string;
  body: string;
  attachmentName?: string;
}): Promise<RemoteSubmission | null> {
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
          assignment_id: input.assignmentId,
          user_id: user.id,
          status: "submitted",
          body: input.body,
          attachment_name: input.attachmentName ?? null,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "assignment_id,user_id" },
      )
      .select("assignment_id, status, score, submitted_at, body, attachment_name")
      .single();
    if (error || !data) return null;
    return mapSubmissionRow(data as unknown as SubmissionRow);
  } catch {
    return null;
  }
}

/** One student's mark for one assignment, as the gradebook holds it. */
export interface MarkRow {
  assignmentId: string;
  studentId: string;
  score: number | null;
  status: RemoteSubmission["status"];
}

/**
 * Every student's submission for a set of assignments — the teaching read.
 * RLS (0020) only answers this for instructors and admins; null means offline,
 * not migrated, or not a teaching account, and the gradebook then keeps using
 * its local copy.
 */
export async function fetchCourseMarks(
  assignmentIds: string[],
): Promise<MarkRow[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase || assignmentIds.length === 0) return null;
  try {
    const { data, error } = await supabase
      .from("submissions")
      .select("assignment_id, user_id, score, status")
      .in("assignment_id", assignmentIds);
    if (error || !data) return null;
    return (data as unknown as {
      assignment_id: string;
      user_id: string;
      score: number | null;
      status: RemoteSubmission["status"];
    }[]).map((r) => ({
      assignmentId: r.assignment_id,
      studentId: r.user_id,
      score: r.score,
      status: r.status ?? "not_started",
    }));
  } catch {
    return null;
  }
}

/**
 * Record (or clear) a mark. Writing a score marks the work graded, which is
 * what the student's own grade page and their guardian's view both read;
 * clearing it returns the row to submitted so it can be marked again.
 *
 * Only a teaching account can satisfy the policy that permits a score, so this
 * returns false for anyone else rather than silently doing nothing.
 */
export async function saveMark(input: {
  assignmentId: string;
  studentId: string;
  score: number | null;
}): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("submissions").upsert(
      {
        assignment_id: input.assignmentId,
        user_id: input.studentId,
        score: input.score,
        status: input.score == null ? "submitted" : "graded",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "assignment_id,user_id" },
    );
    return !error;
  } catch {
    return false;
  }
}
