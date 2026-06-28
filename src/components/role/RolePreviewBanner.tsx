"use client";

import { GraduationCap } from "lucide-react";
import { useRole } from "./RoleProvider";
import { canTeach, roleLabel } from "@/lib/role";

/** A dashboard banner that appears while previewing a teaching role. */
export function RolePreviewBanner() {
  const { role, hydrated } = useRole();
  if (!hydrated || !canTeach(role)) return null;

  return (
    <div className="mb-5 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
      <GraduationCap className="h-5 w-5 shrink-0 text-brand-600" />
      <p>
        You&apos;re previewing the{" "}
        <span className="font-semibold">{roleLabel[role]}</span> view. Teaching
        tools — add content, gradebook, publish — appear on your course pages.
        Switch back to <span className="font-semibold">Student</span> any time
        from the top bar.
      </p>
    </div>
  );
}
