"use client";

import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useRole } from "@/components/role/RoleProvider";
import { isAdmin } from "@/lib/role";
import { roster } from "@/lib/roster";
import { initialsOf } from "@/lib/utils";
import type { Assignment, Course } from "@/lib/types";

export function AdminConsole({
  courses,
  assignments,
}: {
  courses: Course[];
  assignments: Assignment[];
}) {
  const { role, hydrated } = useRole();

  if (!hydrated) return null;

  if (!isAdmin(role)) {
    return (
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div>
          <p className="font-semibold text-ink">Administrators only</p>
          <p className="mt-1 text-sm text-ink-muted">
            Switch to <span className="font-medium">Admin</span> in the top-bar
            role selector to view the console.
          </p>
        </div>
      </div>
    );
  }

  const instructors = Array.from(new Set(courses.map((c) => c.instructor)));
  const published = courses.filter((c) => c.published).length;
  const avgProgress = courses.length
    ? Math.round(courses.reduce((n, c) => n + c.progress, 0) / courses.length)
    : 0;

  return (
    <>
      <PageHeader
        title="Admin console"
        subtitle="Institution-wide overview and management."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat icon={<Users className="h-5 w-5" />} label="Students" value={roster.length} tone="text-brand-600" />
        <Stat icon={<GraduationCap className="h-5 w-5" />} label="Instructors" value={instructors.length} tone="text-sky-600" />
        <Stat icon={<BookOpen className="h-5 w-5" />} label="Courses" value={`${published}/${courses.length}`} tone="text-emerald-600" />
        <Stat icon={<ClipboardList className="h-5 w-5" />} label="Assignments" value={assignments.length} tone="text-amber-600" />
        <Stat icon={<TrendingUp className="h-5 w-5" />} label="Avg progress" value={`${avgProgress}%`} tone="text-violet-600" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Courses table */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Courses
          </h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 bg-surface-subtle text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-3 font-semibold">Course</th>
                  <th className="px-4 py-3 font-semibold">Instructor</th>
                  <th className="px-4 py-3 font-semibold">Credits</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {courses.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-subtle">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-1 rounded-full" style={{ backgroundColor: c.color }} />
                        <div>
                          <p className="font-medium text-ink">{c.name}</p>
                          <p className="text-xs text-ink-faint">{c.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{c.instructor}</td>
                    <td className="px-4 py-3 text-ink-muted">{c.credits}</td>
                    <td className="px-4 py-3">
                      {c.published ? (
                        <Badge tone="success">Published</Badge>
                      ) : (
                        <Badge tone="neutral">Draft</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* People */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">
            People
          </h2>
          <div className="card divide-y divide-black/5">
            {instructors.map((name) => (
              <Person key={name} name={name} role="Instructor" />
            ))}
            {roster.map((s) => (
              <Person key={s.id} name={s.name} role="Student" />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="card flex items-center gap-3 p-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-lg bg-surface-subtle ${tone}`}>
        {icon}
      </span>
      <div>
        <p className="text-lg font-bold leading-none text-ink">{value}</p>
        <p className="mt-1 text-xs text-ink-muted">{label}</p>
      </div>
    </div>
  );
}

function Person({ name, role }: { name: string; role: "Instructor" | "Student" }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <Avatar
        initials={initialsOf(name)}
        color={role === "Instructor" ? "#0284c7" : "#8b94a3"}
        size={32}
      />
      <p className="flex-1 text-sm font-medium text-ink">{name}</p>
      <Badge tone={role === "Instructor" ? "brand" : "neutral"}>{role}</Badge>
    </div>
  );
}
