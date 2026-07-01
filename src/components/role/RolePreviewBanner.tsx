"use client";

import Link from "next/link";
import { GraduationCap, ShieldCheck, Users } from "lucide-react";
import { useRole } from "./RoleProvider";
import { canTeach, isAdmin, isParent, roleLabel } from "@/lib/role";

/** A dashboard banner shown while previewing a non-student role. */
export function RolePreviewBanner() {
  const { role, hydrated } = useRole();
  if (!hydrated) return null;

  if (isAdmin(role)) {
    return (
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
        <ShieldCheck className="h-5 w-5 shrink-0 text-brand-600" />
        <p className="flex-1">
          You&apos;re previewing the <span className="font-semibold">Admin</span>{" "}
          view. Manage courses and people from the console.
        </p>
        <Link
          href="/admin"
          className="focus-ring rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Open Admin
        </Link>
      </div>
    );
  }

  if (isParent(role)) {
    return (
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
        <Users className="h-5 w-5 shrink-0 text-brand-600" />
        <p className="flex-1">
          You&apos;re previewing the <span className="font-semibold">Parent</span>{" "}
          view. Follow your child&apos;s grades and deadlines on the Family page.
        </p>
        <Link
          href="/family"
          className="focus-ring rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Open Family
        </Link>
      </div>
    );
  }

  if (!canTeach(role)) return null;

  return (
    <div className="mb-5 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
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
