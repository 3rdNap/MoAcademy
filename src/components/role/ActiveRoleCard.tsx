"use client";

import { Eye } from "lucide-react";
import { useRole } from "./RoleProvider";
import { Badge } from "@/components/ui/Badge";
import { roleBlurb, roleLabel } from "@/lib/role";

/** Account-page card showing which role is currently being previewed. */
export function ActiveRoleCard() {
  const { role, hydrated } = useRole();
  const current = hydrated ? role : "student";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-black/5 bg-surface-subtle px-3 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Eye className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-ink">Previewing as</p>
          <Badge tone="brand">{roleLabel[current]}</Badge>
        </div>
        <p className="text-xs text-ink-muted">{roleBlurb[current]}</p>
      </div>
    </div>
  );
}
