// Supabase-backed course groups (D2L "Groups" tool, migration 0036). A teaching
// account partitions its enrolled roster into named groups within a course;
// enrolled course-mates read the groups + members; a student reads their own
// membership. RLS enforces all of this via private.teaches_course. Everything
// degrades to null/false on any error so callers fall back to a friendly empty
// state. `courseKey` is the subject id (e.g. sub_math), matching course.id.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface CourseGroup {
  id: string;
  courseKey: string;
  name: string;
  memberIds: string[];
}

interface GroupRow {
  id: string;
  course_key: string;
  name: string;
  group_members: { student_id: string }[] | null;
}

function mapGroup(r: GroupRow): CourseGroup {
  return {
    id: r.id,
    courseKey: r.course_key,
    name: r.name,
    memberIds: (r.group_members ?? []).map((m) => m.student_id),
  };
}

/**
 * Groups for a course with their members, ordered by name. RLS scopes the
 * result (teaching account or enrolled course-mate). Null on any failure.
 */
export async function fetchCourseGroups(
  courseKey: string,
): Promise<CourseGroup[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("course_groups")
      .select("id, course_key, name, group_members(student_id)")
      .eq("course_key", courseKey)
      .order("name", { ascending: true });
    if (error || !data) return null;
    return (data as unknown as GroupRow[]).map(mapGroup);
  } catch {
    return null;
  }
}

/** Create a group as a teaching account (created_by = auth user). Null on failure. */
export async function createGroup(
  courseKey: string,
  name: string,
): Promise<CourseGroup | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("course_groups")
      .insert({ course_key: courseKey, name, created_by: user.id })
      .select("id, course_key, name")
      .single();
    if (error || !data) return null;
    return mapGroup({ ...(data as unknown as GroupRow), group_members: [] });
  } catch {
    return null;
  }
}

/** Rename a group as a teaching account. False on failure. */
export async function renameGroup(id: string, name: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("course_groups")
      .update({ name })
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** Delete a group (members cascade) as a teaching account. False on failure. */
export async function removeGroup(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("course_groups").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** Add a student to a group as a teaching account. False on failure. */
export async function addMember(
  groupId: string,
  studentId: string,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: groupId, student_id: studentId });
    return !error;
  } catch {
    return false;
  }
}

/** Remove a student from a group as a teaching account. False on failure. */
export async function removeMember(
  groupId: string,
  studentId: string,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("student_id", studentId);
    return !error;
  } catch {
    return false;
  }
}
