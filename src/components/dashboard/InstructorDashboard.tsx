import Link from "next/link";
import {
  CalendarClock,
  ClipboardList,
  LineChart,
  Megaphone,
  PlusCircle,
} from "lucide-react";
import type { Announcement, Course, User } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Widget } from "@/components/ui/Widget";
import { CourseCard } from "@/components/dashboard/CourseCard";
import { RolePreviewBanner } from "@/components/role/RolePreviewBanner";
import {
  InstructorStatStrip,
  NeedsGradingWidget,
} from "@/components/dashboard/NeedsGradingWidget";
import { formatDate, relativeTime } from "@/lib/utils";

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The teaching home. Unlike the student dashboard (enrolment language, study
 * plan, college roadmap), this surfaces teaching language and the tools an
 * instructor acts on: a grading backlog, jump-offs into content/attendance,
 * and the courses they teach. Live counts that depend on the taught roster are
 * fetched client-side (see NeedsGradingWidget) since server data scopes to a
 * student's own submissions.
 */
export function InstructorDashboard({
  user,
  courses,
  announcements,
}: {
  user: User;
  courses: Course[];
  announcements: Announcement[];
}) {
  const first = courses[0];
  const actions = first
    ? [
        {
          href: `/courses/${first.id}/announcements`,
          label: "Post announcement",
          icon: Megaphone,
        },
        {
          href: `/courses/${first.id}/assignments`,
          label: "New assignment",
          icon: PlusCircle,
        },
        {
          href: `/courses/${first.id}/attendance`,
          label: "Take attendance",
          icon: ClipboardList,
        },
        {
          href: `/courses/${first.id}/insights`,
          label: "Insights",
          icon: LineChart,
        },
      ]
    : [];

  return (
    <>
      <RolePreviewBanner />
      <PageHeader
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        subtitle={
          courses.length === 0
            ? `Welcome to MoAcademy · ${formatDate(new Date().toISOString())}`
            : `You're teaching ${courses.length} course${
                courses.length === 1 ? "" : "s"
              } this term · ${formatDate(new Date().toISOString())}`
        }
        action={
          <Link
            href="/courses"
            className="focus-ring rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            View all courses
          </Link>
        }
      />

      <InstructorStatStrip courses={courses} />

      {actions.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-black/10 bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-subtle dark:border-white/10"
              >
                <Icon className="h-4 w-4 text-brand-600" />
                {a.label}
              </Link>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">
              Courses you teach
            </h2>
            {courses.length === 0 ? (
              <div className="card flex flex-col items-start gap-2 p-6">
                <p className="font-semibold text-ink">
                  No teaching assignments yet
                </p>
                <p className="text-sm text-ink-muted">
                  The academy office assigns your subjects. Once you&apos;re
                  assigned to a class, it&apos;ll appear here with its roster,
                  gradebook and content tools.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {courses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            )}
          </section>

          <Widget
            title="Recent announcements"
            icon={<Megaphone className="h-4 w-4 text-brand-600" />}
          >
            {announcements.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Nothing posted recently. Use Post announcement to reach your
                classes.
              </p>
            ) : (
              <ul className="space-y-3">
                {announcements.slice(0, 6).map((an) => (
                  <li key={an.id}>
                    <p className="text-sm font-medium text-ink">{an.title}</p>
                    <p className="text-xs text-ink-muted">
                      {an.author} · {relativeTime(an.postedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Widget>
        </div>

        <div className="space-y-6">
          <Widget
            title="Needs grading"
            icon={<CalendarClock className="h-4 w-4 text-brand-600" />}
          >
            <NeedsGradingWidget courses={courses} />
          </Widget>
        </div>
      </div>
    </>
  );
}
