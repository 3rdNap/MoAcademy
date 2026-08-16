import type { Role } from "./types";

// Who sees what.
//
// Every role gets its own designated home and its own navigation — a parent
// has no use for Billing or Practice, and an instructor has no use for a
// student's personal University Roadmap. This module is the single source of
// truth for that, used three ways:
//
//   1. the global nav renders navFor(role) (src/lib/nav.ts, which pairs these
//      areas with their icons);
//   2. middleware redirects real accounts away from areas their role can't
//      reach, so hiding a link is never the only thing standing in the way;
//   3. read-only roles (guardians) render without any create/edit/delete or
//      submit controls.
//
// Deliberately free of React imports: middleware runs on the Edge runtime and
// only needs the route policy, not the icons.

/** Every area of the app, and the route it lives at. */
export const AREA_HREF = {
  dashboard: "/dashboard",
  family: "/family",
  work: "/family/work",
  admin: "/admin",
  courses: "/courses",
  guides: "/study-guides",
  assistant: "/assistant",
  practice: "/practice",
  roadmap: "/roadmap",
  calendar: "/calendar",
  inbox: "/inbox",
  grades: "/grades",
  billing: "/billing",
} as const;

export type AreaKey = keyof typeof AREA_HREF;

/**
 * The areas each role may use, in nav order. The first entry is that role's
 * home — where a blocked request lands them.
 */
export const ROLE_AREAS: Record<Role, AreaKey[]> = {
  // A learner's own study surface.
  student: [
    "dashboard", "courses", "guides", "assistant", "practice",
    "roadmap", "calendar", "inbox", "grades", "billing",
  ],
  // Teaching: course content and assessment. No personal roadmap, no billing
  // (a student's own registration) and no practice quizzes.
  instructor: [
    "dashboard", "courses", "guides", "assistant", "calendar", "inbox", "grades",
  ],
  // Institution-wide management.
  admin: [
    "dashboard", "admin", "courses", "guides", "assistant",
    "calendar", "inbox", "grades", "billing",
  ],
  // A guardian follows a child; they never author or submit anything, so the
  // authoring and study tools are absent rather than merely disabled.
  parent: ["family", "work", "grades", "calendar", "inbox", "roadmap"],
};

/** Where this role starts, and where a blocked request is sent. */
export function homeFor(role: Role): string {
  return AREA_HREF[ROLE_AREAS[role][0]];
}

/**
 * Routes every role may reach regardless of nav — their own account, the auth
 * screens, and the shared landing page.
 */
const ALWAYS_ALLOWED = ["/account", "/login", "/logout", "/signup"];

/**
 * Whether `pathname` is within the areas this role may use.
 *
 * Course pages are reachable by anyone whose nav includes Courses; a guardian
 * reads their child's coursework through the Family area instead, which is
 * scoped to the children they're actually linked to.
 */
export function canAccess(role: Role, pathname: string): boolean {
  if (pathname === "/" || ALWAYS_ALLOWED.some((p) => pathname.startsWith(p))) {
    return true;
  }
  return ROLE_AREAS[role].some((key) => {
    const href = AREA_HREF[key];
    return pathname === href || pathname.startsWith(`${href}/`);
  });
}

/**
 * Roles that may look but not touch. Guardians follow a child's progress; they
 * can't create, edit, delete or submit anything on the child's behalf.
 */
export function isReadOnly(role: Role): boolean {
  return role === "parent";
}
