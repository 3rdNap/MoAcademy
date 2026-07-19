"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarClock,
  FileText,
  Megaphone,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Widget } from "@/components/ui/Widget";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { daysUntil, formatDate, formatDateTime, letterGrade } from "@/lib/utils";
import { MoFamilySummary } from "@/components/family/MoFamilySummary";
import type { Announcement, Assignment, Course } from "@/lib/types";
import type {
  ChildAttendance,
  ChildCourseGrade,
  GuardianChild,
} from "@/lib/data";

export interface ChildView {
  child: GuardianChild;
  courses: Course[];
  upcoming: Assignment[];
  announcements: Announcement[];
  grades: ChildCourseGrade[];
  attendance: ChildAttendance;
}

/**
 * The real parent/guardian dashboard, driven by guardian↔student links
 * (migration 0017). Shows each linked child's registered courses, upcoming
 * published deadlines and announcements. Distinct from the anonymous demo
 * FamilyDashboard, which uses seeded siblings and grade math.
 */
export function GuardianFamily({ childrenData }: { childrenData: ChildView[] }) {
  const [childId, setChildId] = useState(childrenData[0]?.child.id ?? "");
  const current =
    childrenData.find((c) => c.child.id === childId) ?? childrenData[0];

  if (!current) {
    return (
      <>
        <PageHeader
          title="Family"
          subtitle="Follow your child's progress, courses and deadlines."
        />
        <div className="card flex flex-col items-start gap-2 p-6">
          <p className="font-semibold text-ink">No linked students yet</p>
          <p className="text-sm text-ink-muted">
            When your child adds you to their MoAcademy account, they&apos;ll
            appear here with their courses and deadlines.
          </p>
        </div>
      </>
    );
  }

  const { child, courses, upcoming, announcements, grades, attendance } =
    current;
  const attDays =
    attendance.present + attendance.absent + attendance.late + attendance.excused;
  const attRate = attDays
    ? Math.round(((attendance.present + attendance.late) / attDays) * 100)
    : null;
  const initials = child.name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const gradesByCourse = new Map(grades.map((g) => [g.courseId, g]));
  const overall = grades.reduce(
    (acc, g) => ({ earned: acc.earned + g.earned, possible: acc.possible + g.possible }),
    { earned: 0, possible: 0 },
  );
  const overallPct = overall.possible
    ? Math.round((overall.earned / overall.possible) * 100)
    : null;

  return (
    <>
      <PageHeader
        title="Family"
        subtitle="Follow your child's progress, courses and deadlines."
      />

      {/* Child selector (only when a guardian follows more than one child). */}
      {childrenData.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {childrenData.map(({ child: c }) => {
            const active = c.id === child.id;
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
                  initials={c.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")}
                  color={c.avatarColor}
                  size={32}
                />
                <span className="block text-left text-sm font-semibold text-ink">
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Stat strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={<UserRound className="h-5 w-5" />}
          label="Student"
          value={child.name.split(" ")[0]}
          tone="text-brand-600"
        />
        <Stat
          icon={<BookOpen className="h-5 w-5" />}
          label="Courses"
          value={String(courses.length)}
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
        {/* Courses */}
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
              {child.name.split(" ")[0]}&apos;s courses
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {attRate != null && (
                <Badge tone={attendance.absent > 0 ? "warning" : "success"}>
                  {attRate}% attendance · {attendance.absent} absent
                </Badge>
              )}
              {overallPct != null && (
                <Badge tone="neutral">
                  Overall {overallPct}% · {letterGrade(overallPct)}
                </Badge>
              )}
              <Link
                href={`/family/report/${child.id}`}
                className="focus-ring flex items-center gap-1.5 rounded-lg border border-black/10 bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-subtle dark:border-white/10"
              >
                <FileText className="h-3.5 w-3.5" />
                Report card
              </Link>
            </div>
          </div>
          {courses.length === 0 ? (
            <div className="card p-6 text-sm text-ink-muted">
              {child.name.split(" ")[0]} hasn&apos;t registered for any subjects
              yet. Registered subjects appear here as courses.
            </div>
          ) : (
            <div className="card divide-y divide-black/5">
              {courses.map((course) => {
                const grade = gradesByCourse.get(course.id);
                const hasGrade = grade && grade.possible > 0;
                const coursePct = hasGrade
                  ? Math.round((grade.earned / grade.possible) * 100)
                  : null;
                return (
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
                    </div>
                    {hasGrade && coursePct != null && (
                      <div className="text-right">
                        <p className="text-sm font-bold leading-none text-ink">
                          {coursePct}% · {letterGrade(coursePct)}
                        </p>
                        <p className="text-xs text-ink-faint">
                          {grade.earned}/{grade.possible} pts
                        </p>
                      </div>
                    )}
                    <Badge tone="neutral">{course.term}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right column */}
        <div className="space-y-6">
          <MoFamilySummary
            key={child.id}
            childName={child.name}
            courses={courses}
            grades={grades}
            attendance={attendance}
            upcoming={upcoming}
          />

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
                          {course?.code ?? ""} · {formatDateTime(a.dueAt)}
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
            title="Announcements"
            icon={<Megaphone className="h-4 w-4 text-brand-600" />}
          >
            {announcements.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-faint">
                No announcements yet.
              </p>
            ) : (
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
            )}
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
      <div className="min-w-0">
        <p className="truncate text-lg font-bold leading-none text-ink">
          {value}
        </p>
        <p className="mt-1 text-xs text-ink-muted">{label}</p>
      </div>
    </div>
  );
}
