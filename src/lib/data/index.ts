import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
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

/**
 * The institution's active term — read from app_settings (migration 0029, key
 * 'current_term'), which an admin can advance via the console. Falls back to
 * CURRENT_TERM on any error/absence (offline, unmigrated, or unset).
 */
export const getCurrentTerm = cache(async (): Promise<string> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return CURRENT_TERM;
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "current_term")
      .maybeSingle();
    return (data?.value as string) ?? CURRENT_TERM;
  } catch {
    return CURRENT_TERM;
  }
});

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

export interface AdminDashboard {
  activeUsers: number;
  termCourses: { term: string; subjects: number; enrollments: number }[];
  unreadMessages: number;
  systemFlags: { label: string; ok: boolean }[];
}

/**
 * Operations snapshot for the admin dashboard (D2L model): active-user count,
 * per-term course/enrolment tallies, unread messages and environment health.
 * Admin-gated like {@link getAdminOverview}; null for anyone else / on error so
 * the dashboard degrades to its demo preview. System flags carry booleans only
 * — never any key or value (mirrors /api/status).
 */
export const getAdminDashboard = cache(
  async (): Promise<AdminDashboard | null> => {
    const { authed, userId, role } = await getAuthState();
    if (!authed || role !== "admin" || !userId) return null;
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    try {
      const currentTerm = await getCurrentTerm();
      const [users, enr, unread] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("subject_enrollments").select("subject_code, term"),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", userId)
          .is("read_at", null),
      ]);

      // Group enrolments by term → distinct subjects + row count.
      const byTerm = new Map<string, { subjects: Set<string>; rows: number }>();
      for (const r of (enr.data ?? []) as { subject_code: string; term: string }[]) {
        const g = byTerm.get(r.term) ?? { subjects: new Set<string>(), rows: 0 };
        g.subjects.add(r.subject_code);
        g.rows += 1;
        byTerm.set(r.term, g);
      }
      const termCourses = Array.from(byTerm.entries())
        .map(([term, g]) => ({
          term,
          subjects: g.subjects.size,
          enrollments: g.rows,
        }))
        // Current term first, then newest label; cap 3 (mirrors D2L).
        .sort((a, b) => {
          if (a.term === currentTerm) return -1;
          if (b.term === currentTerm) return 1;
          return b.term.localeCompare(a.term);
        })
        .slice(0, 3);
      // Always surface the active term, even before any enrolments exist.
      if (!termCourses.some((t) => t.term === currentTerm)) {
        termCourses.unshift({ term: currentTerm, subjects: 0, enrollments: 0 });
        termCourses.splice(3);
      }

      const systemFlags = [
        { label: "Database", ok: hasSupabaseEnv() },
        {
          label: "Account provisioning",
          ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        },
        { label: "Mo assistant", ok: Boolean(process.env.ANTHROPIC_API_KEY) },
      ];

      return {
        activeUsers: users.count ?? 0,
        termCourses,
        unreadMessages: unread.count ?? 0,
        systemFlags,
      };
    } catch {
      return null;
    }
  },
);

export interface AdminEnrollment {
  subjectCode: string;
  role: Role;
  userId: string;
  name: string;
}

/**
 * Every enrolment row for the current term joined (client-side) with the
 * profiles an admin can read — the raw data behind the console's Enrollments
 * view. Admin-gated; null for anyone else / on error.
 */
export const getAdminEnrollments = cache(
  async (): Promise<AdminEnrollment[] | null> => {
    const { authed, role } = await getAuthState();
    if (!authed || role !== "admin") return null;
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    try {
      const term = await getCurrentTerm();
      const [enr, profs] = await Promise.all([
        supabase
          .from("subject_enrollments")
          .select("subject_code, role, user_id")
          .eq("term", term),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      const names = new Map<string, string>();
      for (const p of (profs.data ?? []) as {
        id: string;
        full_name: string | null;
        email: string | null;
      }[]) {
        names.set(p.id, p.full_name || p.email || "");
      }
      return ((enr.data ?? []) as {
        subject_code: string;
        role: string;
        user_id: string;
      }[]).map((r) => ({
        subjectCode: r.subject_code,
        role: (r.role as Role) ?? "student",
        userId: r.user_id,
        name: names.get(r.user_id) ?? "",
      }));
    } catch {
      return null;
    }
  },
);

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
    const term = await getCurrentTerm();
    // Institutional enrolments first (admin-issued), then legacy paid regs.
    try {
      const { data: enr } = await supabase
        .from("subject_enrollments")
        .select("subject_code")
        .eq("user_id", childId)
        .eq("role", "student")
        .eq("term", term);
      const enrolled = new Set((enr ?? []).map((r) => r.subject_code as string));
      if (enrolled.size > 0) {
        const chosen = subjects.filter((s) => enrolled.has(s.code));
        const names = await instructorNamesFor(
          chosen.map((s) => s.code),
          supabase,
          term,
        );
        return chosen.map((s) => subjectToCourse(s, names.get(s.code), term));
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
    const chosen = subjects.filter((s) => codes.has(s.code));
    const names = await instructorNamesFor(chosen.map((s) => s.code), supabase, term);
    return chosen.map((s) => subjectToCourse(s, names.get(s.code), term));
  } catch {
    return [];
  }
}

export interface RosterMember {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

/** The real enrolled students for a course (subject), for a signed-in
 *  teaching account (or null if not applicable/offline — callers fall back
 *  to the bundled demo roster). */
export async function getCourseRoster(
  courseId: string,
): Promise<RosterMember[] | null> {
  const code = subjects.find((s) => s.id === courseId)?.code;
  if (!code) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const term = await getCurrentTerm();

  let ids: string[];
  try {
    const { data, error } = await supabase
      .from("subject_enrollments")
      .select("user_id")
      .eq("subject_code", code)
      .eq("role", "student")
      .eq("term", term);
    // An RLS-empty result for a non-teacher surfaces as [] here, which is a
    // real "no roster to show" state and falls back below; a query error is a
    // genuine "can't determine a roster" and returns null.
    if (error) return null;
    ids = (data ?? []).map((r) => r.user_id as string);
  } catch {
    return null;
  }
  if (ids.length === 0) return [];

  try {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_color")
      .in("id", ids);
    return (data ?? []).map((p) => ({
      id: p.id as string,
      name: (p.full_name as string) ?? "",
      email: (p.email as string) ?? "",
      avatarColor: (p.avatar_color as string) ?? "#0284c7",
    }));
  } catch {
    return null;
  }
}

export interface MessageContact {
  id: string;
  name: string;
}

/**
 * Who the signed-in user may message: admins can reach everyone; everyone
 * else sees their real course-mates (anyone sharing a subject+term
 * enrolment) — mirrors the RLS in migration 0021. Null when signed
 * out/offline, so the inbox falls back to the demo roster.
 */
export const getMessageContacts = cache(
  async (): Promise<MessageContact[] | null> => {
    const { authed, userId, role } = await getAuthState();
    if (!authed || !userId) return null;
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    try {
      if (role === "admin") {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name")
          .neq("id", userId);
        if (error) return null;
        return (data ?? [])
          .map((p) => ({
            id: p.id as string,
            name: (p.full_name as string) ?? "",
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      const term = await getCurrentTerm();
      const { data: mine, error: mineError } = await supabase
        .from("subject_enrollments")
        .select("subject_code")
        .eq("user_id", userId)
        .eq("term", term);
      if (mineError) return null;
      const codes = Array.from(
        new Set((mine ?? []).map((r) => r.subject_code as string)),
      );
      if (codes.length === 0) return [];

      const { data: mates, error: matesError } = await supabase
        .from("subject_enrollments")
        .select("user_id")
        .in("subject_code", codes)
        .eq("term", term);
      if (matesError) return null;
      const ids = Array.from(
        new Set(
          (mates ?? [])
            .map((r) => r.user_id as string)
            .filter((id) => id !== userId),
        ),
      );
      if (ids.length === 0) return [];

      const { data: profs, error: profError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      if (profError) return null;
      return (profs ?? [])
        .map((p) => ({
          id: p.id as string,
          name: (p.full_name as string) ?? "",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return null;
    }
  },
);

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
function subjectToCourse(
  s: Subject,
  instructorName = "To be assigned",
  term: string = CURRENT_TERM,
): Course {
  let h = 0;
  for (let i = 0; i < s.id.length; i++) h = s.id.charCodeAt(i) + ((h << 5) - h);
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    shortName: s.name,
    term,
    description: `${s.name} · ${s.category}`,
    color: `hsl(${Math.abs(h) % 360} 62% 45%)`,
    instructor: instructorName,
    credits: 1,
    published: true,
    progress: 0,
  };
}

type SupabaseClient = NonNullable<
  Awaited<ReturnType<typeof createSupabaseServerClient>>
>;

/**
 * Real instructor display names for the given subject codes, keyed by code.
 * Resolves `subject_enrollments` teaching rows → `profiles.full_name` under
 * existing RLS (course-mates and admins can read both). Degrades to an empty
 * map on any error or when RLS returns nothing (e.g. guardians), leaving
 * callers with the "To be assigned" default.
 */
async function instructorNamesFor(
  codes: string[],
  supabase: SupabaseClient,
  term: string = CURRENT_TERM,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (codes.length === 0) return map;
  try {
    const { data: teach } = await supabase
      .from("subject_enrollments")
      .select("subject_code, user_id")
      .eq("role", "instructor")
      .eq("term", term)
      .in("subject_code", codes);
    const rows = (teach ?? []) as { subject_code: string; user_id: string }[];
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    if (ids.length === 0) return map;

    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    const names = new Map<string, string>();
    for (const p of (profs ?? []) as { id: string; full_name: string | null }[]) {
      if (p.full_name) names.set(p.id, p.full_name);
    }

    for (const r of rows) {
      const name = names.get(r.user_id);
      if (!name) continue;
      const existing = map.get(r.subject_code);
      map.set(r.subject_code, existing ? `${existing}, ${name}` : name);
    }
  } catch {
    /* RLS/offline — leave names unresolved */
  }
  return map;
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
  body: string | null;
  url: string | null;
  file_path: string | null;
}
function mapItem(r: RawModuleItem): ModuleItem {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    dueAt: r.due_at ?? undefined,
    durationMin: r.duration_min ?? undefined,
    indent: r.indent ?? undefined,
    body: r.body ?? undefined,
    url: r.url ?? undefined,
    filePath: r.file_path ?? undefined,
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
  group_id?: string | null;
  quiz_attempts_allowed?: number | null;
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
    groupId: r.group_id ?? undefined,
    attemptsAllowed: r.quiz_attempts_allowed ?? undefined,
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
        const term = await getCurrentTerm();
        const toCourses = async (chosen: Subject[]): Promise<Course[]> => {
          const names = await instructorNamesFor(
            chosen.map((s) => s.code),
            supabase,
            term,
          );
          return chosen.map((s) => subjectToCourse(s, names.get(s.code), term));
        };

        if (role === "admin") return toCourses(subjects);

        // Institutional model: courses are the subjects an admin has enrolled
        // this person into (as student, or as instructor if they teach it).
        const enrolRole = role === "instructor" ? "instructor" : "student";
        try {
          const { data: enr } = await supabase
            .from("subject_enrollments")
            .select("subject_code")
            .eq("user_id", user.id)
            .eq("role", enrolRole)
            .eq("term", term);
          const enrolled = new Set((enr ?? []).map((r) => r.subject_code as string));
          if (enrolled.size > 0) {
            return toCourses(subjects.filter((s) => enrolled.has(s.code)));
          }
        } catch {
          /* subject_enrollments not migrated yet — fall through */
        }

        // Instructors with no explicit teaching assignment see the catalogue.
        if (role === "instructor") return toCourses(subjects);

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
        return toCourses(subjects.filter((s) => codes.has(s.code)));
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

/** The shared, instructor-editable syllabus for a course (migration 0028).
 *  Null when unset/offline/error, so the board falls back to its empty state
 *  or the anonymous demo's local copy. */
export async function getSyllabus(
  courseId: string,
): Promise<{ body: string; updatedBy: string; updatedAt: string } | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from("course_syllabus")
      .select("body, updated_by, updated_at")
      .eq("course_key", courseId)
      .maybeSingle();
    if (!data) return null;
    return {
      body: (data.body as string) ?? "",
      updatedBy: (data.updated_by as string) ?? "",
      updatedAt: (data.updated_at as string) ?? "",
    };
  } catch {
    return null;
  }
}

export interface CourseMeeting {
  id: string;
  courseKey: string;
  weekday: number;
  startTime: string;
  endTime: string;
  location: string;
}

interface RawCourseMeeting {
  id: string;
  course_key: string;
  weekday: number;
  start_time: string;
  end_time: string;
  location: string | null;
}
function mapMeeting(r: RawCourseMeeting): CourseMeeting {
  return {
    id: r.id,
    courseKey: r.course_key,
    weekday: r.weekday,
    startTime: r.start_time.slice(0, 5),
    endTime: r.end_time.slice(0, 5),
    location: r.location ?? "",
  };
}

/** Weekly timetable slots for a course (migration 0030). Everyone can read;
 *  [] on error/offline, house style. */
export async function getCourseMeetings(courseId: string): Promise<CourseMeeting[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("course_meetings")
      .select("*")
      .eq("course_key", courseId)
      .order("weekday")
      .order("start_time");
    return (data ?? []).map((r) => mapMeeting(r as unknown as RawCourseMeeting));
  } catch {
    return [];
  }
}

// Office hours (migration 0033). Shape mirrors src/lib/office-hours-db.ts;
// kept in sync by hand since the two modules use different Supabase clients.
export interface OfficeHourSlot {
  id: string;
  instructorId: string;
  courseKey: string;
  startsAt: string;
  endsAt: string;
  location: string;
  bookedBy?: string;
  bookedAt?: string;
}

interface RawOfficeHourSlot {
  id: string;
  instructor_id: string;
  course_key: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  booked_by: string | null;
  booked_at: string | null;
}

function mapOfficeHour(r: RawOfficeHourSlot): OfficeHourSlot {
  return {
    id: r.id,
    instructorId: r.instructor_id,
    courseKey: r.course_key,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    location: r.location ?? "",
    bookedBy: r.booked_by ?? undefined,
    bookedAt: r.booked_at ?? undefined,
  };
}

/** Future-or-recent office-hour slots for a course, soonest first, for the
 *  course-home initial render. [] on error/offline — RLS also means anonymous
 *  visitors get [], which the widget treats as "nothing to show". */
export async function getCourseOfficeHours(
  courseId: string,
): Promise<OfficeHourSlot[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  try {
    const since = new Date(Date.now() - 86400000).toISOString();
    const { data } = await supabase
      .from("office_hour_slots")
      .select("*")
      .eq("course_key", courseId)
      .gte("starts_at", since)
      .order("starts_at");
    return (data ?? []).map((r) => mapOfficeHour(r as unknown as RawOfficeHourSlot));
  } catch {
    return [];
  }
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

/** The signed-in user's real activity feed: recent announcements on their
 *  courses plus their own recently graded work, newest first. Falls back to
 *  the bundled demo for anonymous visitors, and to [] on any error. */
export async function getActivity(): Promise<ActivityEvent[]> {
  const { authed } = await getAuthState();
  if (!authed) return seed.activity;
  try {
    const courses = await getCourses();
    const courseIds = courses.map((c) => c.id);
    const [announcements, grades] = await Promise.all([
      getAnnouncementsForCourses(courseIds),
      getRecentGrades(),
    ]);

    const since = Date.now() - 14 * 86400000;
    const events: ActivityEvent[] = [];

    for (const a of announcements) {
      if (new Date(a.postedAt).getTime() < since) continue;
      events.push({
        id: `ann_${a.id}`,
        kind: "announcement",
        courseId: a.courseId,
        title: a.title,
        detail: `${a.author} posted an announcement.`,
        at: a.postedAt,
      });
    }

    for (const g of grades) {
      events.push({
        id: `grade_${g.id}`,
        kind: "grade",
        courseId: g.courseId,
        title: `${g.title} graded`,
        detail: `You scored ${g.score}/${g.points}.`,
        at: g.gradedAt,
      });
    }

    return events
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 12);
  } catch {
    return [];
  }
}

export async function getCalendar(): Promise<CalendarEvent[]> {
  const { authed } = await getAuthState();
  if (!authed) return seed.calendar;
  const assignments = await getAssignments();
  return assignments.map((a) => ({
    id: a.id,
    courseId: a.courseId,
    title: a.title,
    at: a.dueAt,
    type: a.type === "discussion" ? "event" : a.type,
  }));
}

/** Assignments due in the future, soonest first. */
export async function getUpcoming(now = new Date()): Promise<Assignment[]> {
  const all = await getAssignments();
  return all
    .filter((a) => new Date(a.dueAt).getTime() >= now.getTime() - 86400000)
    .filter((a) => a.status !== "graded")
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

export interface RecentGrade {
  id: string; // assignment id
  courseId: string;
  title: string;
  score: number;
  points: number;
  gradedAt: string;
}

interface RawGradedSubmission {
  assignment_id: string;
  score: number | null;
  graded_at: string | null;
  assignments: {
    title: string;
    course_key: string | null;
    course_id?: string | null;
    points: number;
  } | null;
}

/** The signed-in user's own graded work in the last `days` days, newest first. */
export async function getRecentGrades(days = 14): Promise<RecentGrade[]> {
  const { authed, userId } = await getAuthState();
  if (!authed || !userId) return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  try {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data } = await supabase
      .from("submissions")
      .select(
        "assignment_id, score, graded_at, assignments(title, course_key, course_id, points)",
      )
      .eq("user_id", userId)
      .not("graded_at", "is", null)
      .gte("graded_at", since)
      .order("graded_at", { ascending: false });
    const rows = (data ?? []) as unknown as RawGradedSubmission[];
    const grades: RecentGrade[] = [];
    for (const r of rows) {
      if (r.score == null || !r.graded_at || !r.assignments) continue;
      grades.push({
        id: r.assignment_id,
        courseId: r.assignments.course_key ?? r.assignments.course_id ?? "",
        title: r.assignments.title,
        score: r.score,
        points: r.assignments.points,
        gradedAt: r.graded_at,
      });
    }
    return grades;
  } catch {
    return [];
  }
}

export interface ChildCourseGrade {
  courseId: string;
  graded: number; // count of graded items
  earned: number; // points earned
  possible: number; // points possible across graded items
}

interface RawChildSubmission {
  score: number | null;
  assignments: {
    course_key: string | null;
    course_id?: string | null;
    points: number;
  } | null;
}

/** Per-course grade rollup for the given user — shared by the guardian
 *  (child) and self-serve report-card variants below. */
async function courseGradesFor(userId: string): Promise<ChildCourseGrade[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("submissions")
      .select("score, assignments(course_key, course_id, points)")
      .eq("user_id", userId)
      .not("score", "is", null);
    const rows = (data ?? []) as unknown as RawChildSubmission[];
    const byCourse = new Map<string, ChildCourseGrade>();
    for (const r of rows) {
      if (r.score == null || !r.assignments) continue;
      const courseId = r.assignments.course_key ?? r.assignments.course_id ?? "";
      const existing = byCourse.get(courseId) ?? {
        courseId,
        graded: 0,
        earned: 0,
        possible: 0,
      };
      existing.graded += 1;
      existing.earned += r.score;
      existing.possible += r.assignments.points;
      byCourse.set(courseId, existing);
    }
    return Array.from(byCourse.values());
  } catch {
    return [];
  }
}

/** Per-course grade rollup for a linked child (guardian RLS, migration 0017). */
export async function getChildGrades(childId: string): Promise<ChildCourseGrade[]> {
  const { authed, role } = await getAuthState();
  if (!authed || role !== "parent") return [];
  return courseGradesFor(childId);
}

/** Per-course grade rollup for the signed-in user's own submissions — same
 *  shape as {@link getChildGrades}, for the student's own report card. */
export async function getMyCourseGrades(): Promise<ChildCourseGrade[]> {
  const { authed, userId } = await getAuthState();
  if (!authed || !userId) return [];
  return courseGradesFor(userId);
}

export interface ChildAttendance {
  present: number;
  absent: number;
  late: number;
  excused: number;
}

const EMPTY_ATTENDANCE: ChildAttendance = {
  present: 0,
  absent: 0,
  late: 0,
  excused: 0,
};

/** Attendance tallies for the given user — shared by the guardian (child)
 *  and self-serve report-card variants below. */
async function attendanceFor(userId: string): Promise<ChildAttendance> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return EMPTY_ATTENDANCE;
  try {
    const { data } = await supabase
      .from("attendance")
      .select("status")
      .eq("student_id", userId);
    const rows = (data ?? []) as { status: keyof ChildAttendance }[];
    const tally = { ...EMPTY_ATTENDANCE };
    for (const r of rows) {
      if (r.status in tally) tally[r.status] += 1;
    }
    return tally;
  } catch {
    return EMPTY_ATTENDANCE;
  }
}

/**
 * Attendance tallies for a linked child across every course the guardian may
 * read (guardian RLS, migration 0030). Zeroed when signed out / not a parent.
 */
export async function getChildAttendance(
  childId: string,
): Promise<ChildAttendance> {
  const { authed, role } = await getAuthState();
  if (!authed || role !== "parent") return EMPTY_ATTENDANCE;
  return attendanceFor(childId);
}

/** Attendance tallies for the signed-in user's own record — same shape as
 *  {@link getChildAttendance}, for the student's own report card. Zeroed
 *  when signed out. */
export async function getMyAttendance(): Promise<ChildAttendance> {
  const { authed, userId } = await getAuthState();
  if (!authed || !userId) return EMPTY_ATTENDANCE;
  return attendanceFor(userId);
}
