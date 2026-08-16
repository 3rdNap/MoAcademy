"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/components/role/RoleProvider";
import { canAccess, homeFor } from "@/lib/access";

/**
 * Keeps the visible page inside the active role's areas.
 *
 * Real accounts are already stopped in middleware, which is the barrier that
 * matters. This covers the two cases middleware can't: the anonymous demo,
 * where the role is a client-side preview the server never sees, and switching
 * role while sitting on a page the new role has no business on — a guardian
 * should land on Family, not keep staring at a student's dashboard.
 */
export function RoleRouteGuard() {
  const { role, hydrated } = useRole();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (!canAccess(role, pathname)) router.replace(homeFor(role));
  }, [hydrated, role, pathname, router]);

  return null;
}
