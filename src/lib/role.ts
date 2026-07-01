import type { Role } from "./types";

// Client-safe role helpers (no next/headers import) shared by the role context
// and the UI gates. The active role is previewed client-side and persisted in
// the browser; it maps to the authenticated user's role once Supabase Auth is
// wired up.

export const ROLE_KEY = "moacademy.role";

export const ROLES: Role[] = ["student", "instructor", "admin", "parent"];

export const roleLabel: Record<Role, string> = {
  student: "Student",
  instructor: "Instructor",
  admin: "Admin",
  parent: "Parent",
};

export const roleBlurb: Record<Role, string> = {
  student: "Learning view — your courses, grades and planning.",
  instructor: "Teaching view — manage course content and assess students.",
  admin: "Admin view — full management across the institution.",
  parent: "Family view — follow your child's grades and deadlines.",
};

/** Whether a role has teaching/management capabilities. */
export function canTeach(role: Role): boolean {
  return role === "instructor" || role === "admin";
}

/** Whether a role is a parent/guardian. */
export function isParent(role: Role): boolean {
  return role === "parent";
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}
