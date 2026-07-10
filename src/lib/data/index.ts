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
  Role,
  User,
} from "@/lib/types";
import { subjects, type Subject } from "@/lib/billing/subjects";
import { CURRENT_TERM } from "@/lib/billing/registration";
import * as seed from "./seed";

/**
 * Whether a real user is signed in (Supabase Auth). Signed-in users see their
 * own data; anonymous visitors get the bundled demo. cache() dedupes the auth
 * lookup within a request.
 */
export const getAuthState = cache(
  async (): Promise<{ authed: boolean; userId: string | null; role: Role }> => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { authed: false, userId: null, role: "student" };
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { authed: false, userId: null, role: "student" };
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      return {
        authed: true,
        userId: user.id,
        role: (profile?.role as Role) ?? "student",
      };
    } catch {
      return { authed: false, userId: null, role: "student" };
    }
  },
);

export interface AdminPerson {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarColor: string;
}

export interface AdminRegistration {
  id: string;
  invoiceNo: string;
  payerName: string;
  payerEmail: string;
  status: string;
  totalCents: number;
  createdAt: string;
  subjects: string[];
}

export interface AdminOverview {
  people: AdminPerson[];
  counts: { students: number; instructors: number; admins: number };
  summary: { total: number; paid: number; revenueCents: number };
  registrations: AdminRegistration[];
}

/**
 * Institution-wide data for the Admin console — real people and registrations,
 * readable only by a signed-in admin (enforced by RLS, see migration 0015).
 * Returns null for anyone else, so the console falls back to the demo roster.
 */
export const getAdminOverview = cache(async (): Promise<AdminOverview | null> => {
  const { authed, role } = await getAuthState();
  if (!authed || role !== "admin") return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  try {
    const [{ data: profs }, { data: regs }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, role, avatar_color")
        .order("created_at"),
      supabase
        .from("registrations")
        .select(
          "id, invoice_no, payer_name, payer_email, status, total_cents, created_at, registration_items(name)",
        )
        .order("created_at", { ascending: false }),
    ]);
    const people: AdminPerson[] = (profs ?? []).map((p) => ({
      id: p.id as string,
      name: (p.full_name as string) ?? "",
      email: (p.email as string) ?? "",
      role: (p.role as Role) ?? "student",
      avatarColor: (p.avatar_color as string) ?? "#0284c7",
    }));
    const counts = { students: 0, instructors: 0, admins: 0 };
    for (const p of people) {
      if (p.role === "instructor") counts.instructors++;
      else if (p.role === "admin") counts.admins++;
      else counts.students++;
    }
    type RegRow = {
      id: string;
      invoice_no: string;
      payer_name: string;
      payer_email: string;
      status: string;
      total_cents: number;
      created_at: string;
      registration_items: { name: string }[] | null;
    };
    const registrations: AdminRegistration[] = ((regs ?? []) as RegRow[]).map(
      (r) => ({
        id: r.id,
        invoiceNo: r.invoice_no,
        payerName: r.payer_name,
        payerEmail: r.payer_email,
        status: r.status,
        totalCents: r.total_cents ?? 0,
        createdAt: r.created_at,
        subjects: (r.registration_items ?? []).map((i) => i.name),
      }),
    );
    const paid = registrations.filter((r) => r.status === "paid");
    return {
      people,
      counts,
      summary: {
        total: registrations.length,
        paid: paid.length,
        revenueCents: paid.reduce((n, r) => n + r.totalCents, 0),
      },
      registrations,
    };
  } catch {
    return null;
  }
});

export interface GuardianChild {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

/**
 * The students a signed-in parent/guardian is linked to (migration 0017). RLS
 * limits this to their own children; returns [] for anyone else, so the family
 * view falls back to the demo.
 */
export const getGuardianChildren = cache(async (): Promise<GuardianChild[]> => {
  const { authed, userId, role } = await getAuthState();
  if (!authed || role !== "parent" || !userId) return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  try {
    const { data: links } = await supabase
      .from("guardian_links")
      .select("student_id")
      .eq("guardian_id", userId);
    const ids = (links ?? []).map((l) => l.student_id as string);
    if (ids.length === 0) return [];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_color")
      .in("id", ids);
    return (profs ?? []).map((p) => ({
      id: p.id as string,
      name: (p.full_name as string) ?? "",
      email: (p.email as string) ?? "",
      avatarColor: (p.avatar_color as string) ?? "#0284c7",
    }));
  } catch {
    return [];
  }
});

/**
 * A linked child's courses — the subjects they've paid to register for, mapped
 * the same way as the student's own dashboard. RLS (migration 0017) only lets a
 * guardian read registrations belonging to their linked students.
 */
export async function getChildCourses(childId: string): Promise<Course[]> {
  const { authed, role } = await getAuthState();
  if (!authed || role !== "parent") return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  try {
    // Institutional enrolments first (admin-issued), then legacy paid regs.
    try {
      const { data: enr } = await supabase
        .from("subject_enrollments")
        .select("subject_code")
        .eq("user_id", childId)
        .eq("role", "student")
        .eq("term", CURRENT_TERM);
      const enrolled = new Set((enr ?? []).map((r) => r.subject_code as string));
      if (enrolled.size > 0) {
        return subjects.filter((s) => enrolled.has(s.code)).map(subjectToCourse);
      }
    } catch {
      /* subject_enrollments not migrated yet */
    }
    const { data: regs } = await supabase
      .from("registrations")
      .select("status, registration_items(code)")
      .eq("user_id", childId)
      .eq("status", "paid");
    const codes = new Set<string>();
    for (const r of (regs ?? []) as { registration_items?: { code: string }[] }[]) {
      for (const it of r.registration_items ?? []) codes.add(it.code);
    }
    return subjects.filter((s) => codes.has(s.code)).map(subjectToCourse);
  } catch {
    return [];
  }
}

/** Published assignments across a set of course ids (course_key), soonest first. */
export async function getAssignmentsForCourses(
  courseIds: string[],
): Promise<Assignment[]> {
  if (courseIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("assignments")
      .select("*")
      .in("course_key", courseIds)
      .order("due_at");
    return (data ?? []).length
      ? (data as unknown as RawAssignment[]).map(mapAssignment)
      : [];
  } catch {
    return [];
  }
}

/** Published announcements across a set of course ids (course_key), newest first. */
export async function getAnnouncementsForCourses(
  courseIds: string[],
): Promise<Announcement[]> {
  if (courseIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .in("course_key", courseIds)
      .order("posted_at", { ascending: false });
    return (data ?? []).length
      ? (data as unknown as RawAnnouncement[]).map(mapAnnouncement)
      : [];
  } catch {
    return [];
  }
}

/** A registered subject becomes the student's course. */
function subjectToCourse(s: Subject): Course {
  let h = 0;
  for (let i = 0; i < s.id.length; i++) h = s.id.charCodeAt(i) + ((h << 5) - h);
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    shortName: s.name,
    term: CURRENT_TERM,
    description: `${s.name} · ${s.category}`,
    color: `hsl(${Math.abs(h) % 360} 62% 45%)`,
    instructor: "To be assigned",
    credits: 1,
    published: true,
    progress: 0,
  };
}

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
  course_id: string | null;
  course_key?: string | null;
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
    // Authored rows reference seed courses via course_key (see migration 0011).
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

interface RawAnnouncement {
  id: string;
  course_id: string | null;
  course_key?: string | null;
  title: string;
  author: string;
  body: string;
  posted_at: string;
}
function mapAnnouncement(r: RawAnnouncement): Announcement {
  return {
    id: r.id,
    // Authored rows reference seed courses via course_key (see migration 0010).
    courseId: r.course_key ?? r.course_id ?? "",
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Admin-created courses (once any exist) are shown to everyone.
      const { data: courseRows } = await supabase
        .from("courses")
        .select("*")
        .order("created_at");
      if (courseRows && courseRows.length) {
        return (courseRows as unknown as RawCourse[]).map(mapCourse);
      }

      // Signed-in user with no real courses yet: derive from their world
      // instead of showing the demo.
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        const role = (profile?.role as Role) ?? "student";
        if (role === "admin") return subjects.map(subjectToCourse);

        // Institutional model: courses are the subjects an admin has enrolled
        // this person into (as student, or as instructor if they teach it).
        const enrolRole = role === "instructor" ? "instructor" : "student";
        try {
          const { data: enr } = await supabase
            .from("subject_enrollments")
            .select("subject_code")
            .eq("user_id", user.id)
            .eq("role", enrolRole)
            .eq("term", CURRENT_TERM);
          const enrolled = new Set((enr ?? []).map((r) => r.subject_code as string));
          if (enrolled.size > 0) {
            return subjects.filter((s) => enrolled.has(s.code)).map(subjectToCourse);
          }
        } catch {
          /* subject_enrollments not migrated yet — fall through */
        }

        // Instructors with no explicit teaching assignment see the catalogue.
        if (role === "instructor") return subjects.map(subjectToCourse);

        // Legacy fallback: subjects a student previously paid to register for.
        const { data: regs } = await supabase
          .from("registrations")
          .select("status, registration_items(code)")
          .eq("user_id", user.id)
          .eq("status", "paid");
        const codes = new Set<string>();
        for (const r of (regs ?? []) as { registration_items?: { code: string }[] }[]) {
          for (const it of r.registration_items ?? []) codes.add(it.code);
        }
        return subjects.filter((s) => codes.has(s.code)).map(subjectToCourse);
      }
    } catch {
      /* fall through to demo */
    }
  }
  // Anonymous / no backend: the bundled demo.
  return seed.courses;
});

export async function getCourse(id: string): Promise<Course | undefined> {
  const all = await getCourses();
  return all.find((c) => c.id === id);
}

export const getModules = cache(async (courseId: string): Promise<CourseModule[]> => {
  const { authed } = await getAuthState();
  // Seed modules are demo-only; signed-in users see just real content.
  const seedRows = authed ? [] : seed.modules.filter((m) => m.courseId === courseId);

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    try {
      // Instructor-published modules reference seed courses via course_key
      // (text), so they merge with the bundled modules rather than replacing
      // them (see migration 0012).
      const { data: mods } = await supabase
        .from("modules")
        .select("*")
        .eq("course_key", courseId)
        .order("position");
      if (mods && mods.length) {
        const ids = mods.map((m) => m.id);
        const { data: items } = await supabase
          .from("module_items")
          .select("*")
          .in("module_id", ids)
          .order("position");
        const rawItems = (items ?? []) as unknown as RawModuleItem[];
        const dbModules = mods.map((m) => ({
          id: m.id as string,
          courseId: (m.course_key ?? m.course_id) as string,
          title: m.title as string,
          published: m.published as boolean,
          items: rawItems.filter((it) => it.module_id === m.id).map(mapItem),
        }));
        return [...seedRows, ...dbModules];
      }
    } catch {
      /* fall through */
    }
  }
  return seedRows;
});

export const getAssignments = cache(async (courseId?: string): Promise<Assignment[]> => {
  const { authed } = await getAuthState();
  const seedRows = authed
    ? []
    : courseId
      ? seed.assignments.filter((a) => a.courseId === courseId)
      : seed.assignments;

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    try {
      // Instructor-published rows reference courses via course_key (text), so
      // they merge with the bundled assignments (demo only) rather than
      // replacing them. This also puts published deadlines into getUpcoming.
      let query = supabase.from("assignments").select("*").order("due_at");
      if (courseId) {
        query = query.eq("course_key", courseId);
      } else if (authed) {
        // Dashboard/calendar: scope to just the signed-in user's courses.
        const ids = (await getCourses()).map((c) => c.id);
        if (ids.length === 0) return [];
        query = query.in("course_key", ids);
      }
      const { data } = await query;
      const dbRows = (data ?? []).length
        ? (data as unknown as RawAssignment[]).map(mapAssignment)
        : [];
      if (dbRows.length || seedRows.length) {
        return [...dbRows, ...seedRows].sort(
          (a, b) => +new Date(a.dueAt) - +new Date(b.dueAt),
        );
      }
    } catch {
      /* fall through */
    }
  }
  return seedRows;
});

export const getAnnouncements = cache(async (
  courseId?: string,
): Promise<Announcement[]> => {
  const { authed } = await getAuthState();
  const seedRows = authed
    ? []
    : courseId
      ? seed.announcements.filter((a) => a.courseId === courseId)
      : seed.announcements;

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    try {
      // Instructor-published rows reference courses via course_key (text), so
      // they merge with the bundled announcements (demo only).
      let query = supabase
        .from("announcements")
        .select("*")
        .order("posted_at", { ascending: false });
      if (courseId) {
        query = query.eq("course_key", courseId);
      } else if (authed) {
        const ids = (await getCourses()).map((c) => c.id);
        if (ids.length === 0) return [];
        query = query.in("course_key", ids);
      }
      const { data } = await query;
      const dbRows = (data ?? []).length
        ? (data as unknown as RawAnnouncement[]).map(mapAnnouncement)
        : [];
      if (dbRows.length || seedRows.length) {
        return [...dbRows, ...seedRows].sort(
          (a, b) => +new Date(b.postedAt) - +new Date(a.postedAt),
        );
      }
    } catch {
      /* fall through */
    }
  }
  return seedRows;
});

export async function getActivity(): Promise<ActivityEvent[]> {
  const { authed } = await getAuthState();
  return authed ? [] : seed.activity;
}

export async function getCalendar(): Promise<CalendarEvent[]> {
  const { authed } = await getAuthState();
  return authed ? [] : seed.calendar;
}

/** Assignments due in the future, soonest first. */
export async function getUpcoming(now = new Date()): Promise<Assignment[]> {
  const all = await getAssignments();
  return all
    .filter((a) => new Date(a.dueAt).getTime() >= now.getTime() - 86400000)
    .filter((a) => a.status !== "graded")
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}
