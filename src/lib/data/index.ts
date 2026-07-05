import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Announcement,
  Assignment,
  ActivityEvent,
  CalendarEvent,
  Course,
  CourseModule,
  ModuleItem,
  User,
} from "@/lib/types";
import * as seed from "./seed";

// ---------------------------------------------------------------------------
// Single data-access surface for the app. Each function tries Supabase first
// and falls back to bundled seed data, so every page works with or without a
// configured backend — and any Supabase error transparently degrades to seed
// rather than breaking the page. Rows are mapped from snake_case columns to the
// app's camelCase domain types.
// ---------------------------------------------------------------------------

/* ----------------------------- row mappers ------------------------------ */

interface RawCourse {
  id: string;
  code: string;
  name: string;
  short_name: string;
  term: string;
  description: string;
  color: string;
  instructor: string;
  credits: number;
  published: boolean;
  progress?: number;
}
function mapCourse(r: RawCourse): Course {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    shortName: r.short_name,
    term: r.term as Course["term"],
    description: r.description,
    color: r.color,
    instructor: r.instructor,
    credits: r.credits,
    published: r.published,
    progress: r.progress ?? 0,
  };
}

interface RawModuleItem {
  id: string;
  module_id: string;
  title: string;
  type: ModuleItem["type"];
  due_at: string | null;
  duration_min: number | null;
  indent: number | null;
}
function mapItem(r: RawModuleItem): ModuleItem {
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

interface RawAssignment {
  id: string;
  course_id: string;
  title: string;
  type: Assignment["type"];
  description: string;
  due_at: string;
  available_at: string | null;
  points: number;
}
function mapAssignment(r: RawAssignment): Assignment {
  return {
    id: r.id,
    courseId: r.course_id,
    title: r.title,
    type: r.type,
    description: r.description,
    dueAt: r.due_at,
    availableAt: r.available_at ?? undefined,
    points: r.points,
    status: "not_started",
  };
}

interface RawAnnouncement {
  id: string;
  course_id: string;
  title: string;
  author: string;
  body: string;
  posted_at: string;
}
function mapAnnouncement(r: RawAnnouncement): Announcement {
  return {
    id: r.id,
    courseId: r.course_id,
    title: r.title,
    author: r.author,
    body: r.body,
    postedAt: r.posted_at,
  };
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/* ------------------------------- queries -------------------------------- */

export const getCurrentUser = cache(async (): Promise<User> => {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Prefer the profiles row (authoritative role/name); fall back to
        // auth metadata.
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role, avatar_color")
          .eq("id", user.id)
          .maybeSingle();

        const name =
          (profile?.full_name as string) ??
          (user.user_metadata?.full_name as string) ??
          user.email ??
          "Student";
        return {
          id: user.id,
          name,
          email: user.email ?? "",
          role:
            (profile?.role as User["role"]) ??
            (user.user_metadata?.role as User["role"]) ??
            "student",
          avatarColor: (profile?.avatar_color as string) ?? "#0284c7",
          initials: initialsOf(name),
        };
      }
    } catch {
      // fall through to seed
    }
  }
  return seed.currentUser;
});

export const getCourses = cache(async (): Promise<Course[]> => {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("created_at");
      if (!error && data && data.length) {
        return (data as unknown as RawCourse[]).map(mapCourse);
      }
    } catch {
      /* fall through */
    }
  }
  return seed.courses;
});

export async function getCourse(id: string): Promise<Course | undefined> {
  const all = await getCourses();
  return all.find((c) => c.id === id);
}

export const getModules = cache(async (courseId: string): Promise<CourseModule[]> => {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    try {
      const { data: mods } = await supabase
        .from("modules")
        .select("*")
        .eq("course_id", courseId)
        .order("position");
      if (mods && mods.length) {
        const ids = mods.map((m) => m.id);
        const { data: items } = await supabase
          .from("module_items")
          .select("*")
          .in("module_id", ids)
          .order("position");
        const rawItems = (items ?? []) as unknown as RawModuleItem[];
        return mods.map((m) => ({
          id: m.id as string,
          courseId: m.course_id as string,
          title: m.title as string,
          published: m.published as boolean,
          items: rawItems.filter((it) => it.module_id === m.id).map(mapItem),
        }));
      }
    } catch {
      /* fall through */
    }
  }
  return seed.modules.filter((m) => m.courseId === courseId);
});

export const getAssignments = cache(async (courseId?: string): Promise<Assignment[]> => {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    try {
      let query = supabase.from("assignments").select("*").order("due_at");
      if (courseId) query = query.eq("course_id", courseId);
      const { data } = await query;
      if (data && data.length) {
        return (data as unknown as RawAssignment[]).map(mapAssignment);
      }
    } catch {
      /* fall through */
    }
  }
  return courseId
    ? seed.assignments.filter((a) => a.courseId === courseId)
    : seed.assignments;
});

export const getAnnouncements = cache(async (
  courseId?: string,
): Promise<Announcement[]> => {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    try {
      let query = supabase
        .from("announcements")
        .select("*")
        .order("posted_at", { ascending: false });
      if (courseId) query = query.eq("course_id", courseId);
      const { data } = await query;
      if (data && data.length) {
        return (data as unknown as RawAnnouncement[]).map(mapAnnouncement);
      }
    } catch {
      /* fall through */
    }
  }
  return courseId
    ? seed.announcements.filter((a) => a.courseId === courseId)
    : seed.announcements;
});

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
