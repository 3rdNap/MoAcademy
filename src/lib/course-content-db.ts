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
  group_id: string | null;
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
    groupId: r.group_id ?? undefined,
    status: "not_started",
  };
}

export interface AssignmentInput {
  title: string;
  type: Assignment["type"];
  description: string;
  dueAt: string;
  points: number;
  groupId?: string;
}

function toAssignmentRow(input: AssignmentInput) {
  return {
    title: input.title,
    type: input.type,
    description: input.description,
    due_at: input.dueAt,
    points: input.points,
    group_id: input.groupId ?? null,
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

/* --------------------------- assignment groups -------------------------- */

interface AssignmentGroupRow {
  id: string;
  course_key: string;
  name: string;
  weight: number;
  position: number;
}

export interface AssignmentGroup {
  id: string;
  courseKey: string;
  name: string;
  weight: number;
  position: number;
}

function mapGroupRow(r: AssignmentGroupRow): AssignmentGroup {
  return {
    id: r.id,
    courseKey: r.course_key,
    name: r.name,
    weight: r.weight,
    position: r.position,
  };
}

/** Weighted grading buckets for a course, ordered — or null when offline. */
export async function fetchAssignmentGroups(
  courseKey: string,
): Promise<AssignmentGroup[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("assignment_groups")
      .select("*")
      .eq("course_key", courseKey)
      .order("position");
    if (error || !data) return null;
    return (data as unknown as AssignmentGroupRow[]).map(mapGroupRow);
  } catch {
    return null;
  }
}

/** Create a group. Null when refused (not a teaching account). */
export async function addAssignmentGroup(
  courseKey: string,
  input: { name: string; weight: number; position: number },
): Promise<AssignmentGroup | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("assignment_groups")
      .insert({
        course_key: courseKey,
        name: input.name,
        weight: input.weight,
        position: input.position,
      })
      .select()
      .single();
    if (error || !data) return null;
    return mapGroupRow(data as unknown as AssignmentGroupRow);
  } catch {
    return null;
  }
}

export async function updateAssignmentGroup(
  id: string,
  patch: { name?: string; weight?: number; position?: number },
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("assignment_groups")
      .update(patch)
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

export async function removeAssignmentGroup(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("assignment_groups")
      .delete()
      .eq("id", id);
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

/* ------------------------------- syllabus ------------------------------- */

/** Upsert a course's shared syllabus (migration 0028). False when refused
 *  (not a teaching account) or offline, so the board can note the failure. */
export async function saveRemoteSyllabus(
  courseKey: string,
  body: string,
  updatedBy: string,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from("course_syllabus").upsert({
      course_key: courseKey,
      body,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

/* --------------------------------- meetings ------------------------------ */

export interface CourseMeeting {
  id: string;
  courseKey: string;
  weekday: number;
  startTime: string;
  endTime: string;
  location: string;
}

interface CourseMeetingRow {
  id: string;
  course_key: string;
  weekday: number;
  start_time: string;
  end_time: string;
  location: string | null;
}

function mapMeetingRow(r: CourseMeetingRow): CourseMeeting {
  return {
    id: r.id,
    courseKey: r.course_key,
    weekday: r.weekday,
    startTime: r.start_time.slice(0, 5),
    endTime: r.end_time.slice(0, 5),
    location: r.location ?? "",
  };
}

/** Weekly timetable slots for a course (migration 0030) — or null when offline. */
export async function fetchCourseMeetings(
  courseKey: string,
): Promise<CourseMeeting[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("course_meetings")
      .select("*")
      .eq("course_key", courseKey)
      .order("weekday")
      .order("start_time");
    if (error || !data) return null;
    return (data as unknown as CourseMeetingRow[]).map(mapMeetingRow);
  } catch {
    return null;
  }
}

/** Meetings across several courses at once (calendar), keyed like the above —
 *  or null when offline. */
export async function fetchMeetingsForCourses(
  courseKeys: string[],
): Promise<CourseMeeting[] | null> {
  if (courseKeys.length === 0) return [];
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("course_meetings")
      .select("*")
      .in("course_key", courseKeys)
      .order("weekday")
      .order("start_time");
    if (error || !data) return null;
    return (data as unknown as CourseMeetingRow[]).map(mapMeetingRow);
  } catch {
    return null;
  }
}

/** Add a timetable slot. Null when refused (not a teaching account). */
export async function addCourseMeeting(
  courseKey: string,
  input: { weekday: number; startTime: string; endTime: string; location: string },
): Promise<CourseMeeting | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("course_meetings")
      .insert({
        course_key: courseKey,
        weekday: input.weekday,
        start_time: input.startTime,
        end_time: input.endTime,
        location: input.location,
      })
      .select()
      .single();
    if (error || !data) return null;
    return mapMeetingRow(data as unknown as CourseMeetingRow);
  } catch {
    return null;
  }
}

export async function removeCourseMeeting(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("course_meetings").delete().eq("id", id);
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
