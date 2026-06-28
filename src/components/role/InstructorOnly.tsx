"use client";

import { useRole } from "./RoleProvider";
import { canTeach } from "@/lib/role";

/** Renders children only for instructor/admin roles (after hydration). */
export function InstructorOnly({ children }: { children: React.ReactNode }) {
  const { role, hydrated } = useRole();
  if (!hydrated || !canTeach(role)) return null;
  return <>{children}</>;
}

/** Renders children only for the student role (after hydration). */
export function StudentOnly({ children }: { children: React.ReactNode }) {
  const { role, hydrated } = useRole();
  if (!hydrated || canTeach(role)) return null;
  return <>{children}</>;
}
