import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Announcement,
  Assignment,
  ActivityEvent,
  CalendarEvent,
  Course,
  CourseModule,
  User,
} from "@/lib/types";
import * as seed from "./seed";

// ---------------------------------------------------------------------------
// Single data-access surface for the app. Each function tries Supabase first
// and falls back to bundled seed data, so every page works with or without a
// configured backend. When you wire real tables, fill in the Supabase branch;
// the seed branch keeps local/dev/demo working.
// ---------------------------------------------------------------------------

export async function getCurrentUser(): Promise<User> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const name =
        (user.user_metadata?.full_name as string) ?? user.email ?? "Student";
      return {
        id: user.id,
        name,
        email: user.email ?? "",
        role: (user.user_metadata?.role as User["role"]) ?? "student",
        avatarColor: "#5d3fea",
        initials: name
          .split(" ")
          .slice(0, 2)
          .map((p) => p[0]?.toUpperCase() ?? "")
          .join(""),
      };
    }
  }
  return seed.currentUser;
}

export async function getCourses(): Promise<Course[]> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { data } = await supabase.from("courses").select("*");
    if (data && data.length) return data as unknown as Course[];
  }
  return seed.courses;
}

export async function getCourse(id: string): Promise<Course | undefined> {
  const all = await getCourses();
  return all.find((c) => c.id === id);
}

export async function getModules(courseId: string): Promise<CourseModule[]> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { data } = await supabase
      .from("modules")
      .select("*")
      .eq("course_id", courseId);
    if (data && data.length) return data as unknown as CourseModule[];
  }
  return seed.modules.filter((m) => m.courseId === courseId);
}

export async function getAssignments(courseId?: string): Promise<Assignment[]> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const query = supabase.from("assignments").select("*");
    const { data } = courseId
      ? await query.eq("course_id", courseId)
      : await query;
    if (data && data.length) return data as unknown as Assignment[];
  }
  return courseId
    ? seed.assignments.filter((a) => a.courseId === courseId)
    : seed.assignments;
}

export async function getAnnouncements(
  courseId?: string,
): Promise<Announcement[]> {
  return courseId
    ? seed.announcements.filter((a) => a.courseId === courseId)
    : seed.announcements;
}

export async function getActivity(): Promise<ActivityEvent[]> {
  return seed.activity;
}

export async function getCalendar(): Promise<CalendarEvent[]> {
  return seed.calendar;
}

/** Assignments due in the future, soonest first. */
export async function getUpcoming(now = new Date()): Promise<Assignment[]> {
  const all = await getAssignments();
  return all
    .filter((a) => new Date(a.dueAt).getTime() >= now.getTime() - 86400000)
    .filter((a) => a.status !== "graded")
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}
