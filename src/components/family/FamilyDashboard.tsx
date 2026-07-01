"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  CalendarClock,
  GraduationCap,
  Megaphone,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Widget } from "@/components/ui/Widget";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { children as demoChildren } from "@/lib/family";
import {
  clampPct,
  daysUntil,
  formatDate,
  formatDateTime,
  letterGrade,
  relativeTime,
} from "@/lib/utils";
import type {
  ActivityEvent,
  Announcement,
  Assignment,
  Course,
} from "@/lib/types";

export function FamilyDashboard({
  courses,
  assignments,
  announcements,
  activity,
}: {
  courses: Course[];
  assignments: Assignment[];
  announcements: Announcement[];
  activity: ActivityEvent[];
}) {
  const [childId, setChildId] = useState(demoChildren[0].id);
  const child = demoChildren.find((c) => c.id === childId) ?? demoChildren[0];

  // Per-course current grade (from graded seed assignments) with the child's
  // offset applied.
  const courseGrades = useMemo(() => {
    return courses.map((course) => {
      const graded = assignments.filter(
        (a) => a.courseId === course.id && a.status === "graded" && a.score != null,
      );
      const earned = graded.reduce((n, a) => n + (a.score ?? 0), 0);
      const possible = graded.reduce((n, a) => n + a.points, 0);
      const pct =
        possible > 0 ? clampPct(Math.round((earned / possible) * 100) + child.gradeDelta) : null;
      return { course, pct, count: graded.length };
    });
  }, [courses, assignments, child.gradeDelta]);

  const overall = useMemo(() => {
    const withGrades = courseGrades.filter((c) => c.pct != null);
    if (withGrades.length === 0) return null;
    return Math.round(
      withGrades.reduce((n, c) => n + (c.pct ?? 0), 0) / withGrades.length,
    );
  }, [courseGrades]);

  const upcoming = useMemo(
    () =>
      assignments
        .filter((a) => a.status !== "graded")
        .filter((a) => daysUntil(a.dueAt) >= 0 && daysUntil(a.dueAt) <= 14)
        .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))
        .slice(0, 6),
    [assignments],
  );

  const recentGrades = activity.filter((e) => e.kind === "grade");

  return (
    <>
      <PageHeader
        title="Family"
        subtitle="Follow your child's progress, grades and upcoming deadlines."
      />

      {/* Child selector */}
      <div className="mb-6 flex flex-wrap gap-2">
        {demoChildren.map((c) => {
          const active = c.id === childId;
          return (
            <button
              key={c.id}
              onClick={() => setChildId(c.id)}
              className={
                active
                  ? "focus-ring flex items-center gap-2 rounded-xl border-2 border-brand-500 bg-brand-50 px-3 py-2 dark:bg-brand-500/10"
                  : "focus-ring flex items-center gap-2 rounded-xl border border-black/10 bg-surface px-3 py-2 hover:bg-surface-subtle dark:border-white/10"
              }
              aria-pressed={active}
            >
              <Avatar
                initials={c.name.split(" ").map((p) => p[0]).join("")}
                color={c.avatarColor}
                size={32}
              />
              <span className="text-left">
                <span className="block text-sm font-semibold text-ink">
                  {c.name}
                </span>
                <span className="block text-xs text-ink-faint">{c.grade}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Stat strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={<GraduationCap className="h-5 w-5" />}
          label="Overall average"
          value={overall != null ? `${overall}% · ${letterGrade(overall)}` : "—"}
          tone="text-brand-600"
        />
        <Stat
          icon={<Activity className="h-5 w-5" />}
          label="Courses"
          value={String(courses.filter((c) => c.published).length)}
          tone="text-sky-600"
        />
        <Stat
          icon={<CalendarClock className="h-5 w-5" />}
          label="Due in 2 weeks"
          value={String(upcoming.length)}
          tone="text-amber-600"
        />
        <Stat
          icon={<Megaphone className="h-5 w-5" />}
          label="Announcements"
          value={String(announcements.length)}
          tone="text-emerald-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Courses + grades */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">
            {child.name.split(" ")[0]}&apos;s courses
          </h2>
          <div className="card divide-y divide-black/5">
            {courseGrades.map(({ course, pct, count }) => (
              <div key={course.id} className="flex items-center gap-4 p-4">
                <span
                  className="h-10 w-1.5 rounded-full"
                  style={{ backgroundColor: course.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{course.name}</p>
                  <p className="text-xs text-ink-faint">
                    {course.code} · {course.instructor}
                  </p>
                  <div className="mt-2 max-w-md">
                    <ProgressBar value={pct ?? 0} color={course.color} />
                  </div>
                  <p className="mt-1 text-xs text-ink-faint">
                    {count} graded {count === 1 ? "item" : "items"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {pct != null ? (
                    <>
                      <p className="text-xl font-bold text-ink">{pct}%</p>
                      <Badge tone="success">{letterGrade(pct)}</Badge>
                    </>
                  ) : (
                    <Badge tone="neutral">No grades</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right column */}
        <div className="space-y-6">
          <Widget
            title="Upcoming deadlines"
            icon={<CalendarClock className="h-4 w-4 text-brand-600" />}
            bodyClassName="pt-1"
          >
            {upcoming.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-faint">
                Nothing due in the next two weeks.
              </p>
            ) : (
              <ul className="divide-y divide-black/5">
                {upcoming.map((a) => {
                  const course = courses.find((c) => c.id === a.courseId);
                  const d = daysUntil(a.dueAt);
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-2.5">
                      <span
                        className="h-8 w-1 rounded-full"
                        style={{ backgroundColor: course?.color ?? "#8b94a3" }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {a.title}
                        </p>
                        <p className="truncate text-xs text-ink-faint">
                          {course?.code} · {formatDateTime(a.dueAt)}
                        </p>
                      </div>
                      <Badge tone={d <= 1 ? "danger" : d <= 7 ? "warning" : "neutral"}>
                        {d === 0 ? "Today" : d === 1 ? "Tomorrow" : `${d}d`}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Widget>

          <Widget
            title="Recent grades"
            icon={<GraduationCap className="h-4 w-4 text-brand-600" />}
            bodyClassName="pt-1"
          >
            <ul className="space-y-3">
              {recentGrades.map((e) => (
                <li key={e.id}>
                  <p className="text-sm font-medium text-ink">{e.title}</p>
                  <p className="text-xs text-ink-muted">
                    {e.detail} · {relativeTime(e.at)}
                  </p>
                </li>
              ))}
            </ul>
          </Widget>

          <Widget
            title="Announcements"
            icon={<Megaphone className="h-4 w-4 text-brand-600" />}
          >
            <ul className="space-y-3">
              {announcements.map((an) => (
                <li key={an.id}>
                  <p className="text-sm font-medium text-ink">{an.title}</p>
                  <p className="text-xs text-ink-muted">
                    {an.author} · {formatDate(an.postedAt)}
                  </p>
                </li>
              ))}
            </ul>
          </Widget>
        </div>
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
  value: string;
  tone: string;
}) {
  return (
    <div className="card flex items-center gap-3 p-3">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-lg bg-surface-subtle ${tone}`}
      >
        {icon}
      </span>
      <div>
        <p className="text-lg font-bold leading-none text-ink">{value}</p>
        <p className="mt-1 text-xs text-ink-muted">{label}</p>
      </div>
    </div>
  );
}
