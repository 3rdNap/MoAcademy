import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, Megaphone } from "lucide-react";
import { Widget } from "@/components/ui/Widget";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CourseScheduleWidget } from "@/components/courses/CourseScheduleWidget";
import { OfficeHoursWidget } from "@/components/courses/OfficeHoursWidget";
import { itemIcon } from "@/lib/itemMeta";
import {
  getAnnouncements,
  getAssignments,
  getCourse,
  getCourseMeetings,
  getCourseOfficeHours,
  getModules,
} from "@/lib/data";
import { daysUntil, formatDateTime, relativeTime } from "@/lib/utils";

export default async function CourseHomePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, modules, assignments, announcements, meetings, officeHours] =
    await Promise.all([
      getCourse(courseId),
      getModules(courseId),
      getAssignments(courseId),
      getAnnouncements(courseId),
      getCourseMeetings(courseId),
      getCourseOfficeHours(courseId),
    ]);
  if (!course) notFound();

  const todo = assignments
    .filter((a) => a.status !== "graded")
    .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))
    .slice(0, 4);

  const totalItems = modules.reduce((n, m) => n + m.items.length, 0);
  const doneItems = modules.reduce(
    (n, m) => n + m.items.filter((i) => i.completed).length,
    0,
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <section className="card p-5">
          <h2 className="text-lg font-semibold text-ink">Welcome</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            {course.description}
          </p>
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-ink-muted">
                {doneItems} of {totalItems} items complete
              </span>
              <span className="font-semibold" style={{ color: course.color }}>
                {course.progress}%
              </span>
            </div>
            <ProgressBar value={course.progress} color={course.color} />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
              Course modules
            </h2>
            <Link
              href={`/courses/${course.id}/modules`}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="space-y-3">
            {modules.map((m) => {
              const done = m.items.filter((i) => i.completed).length;
              return (
                <li key={m.id} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium text-ink">{m.title}</h3>
                    {m.published ? (
                      <Badge tone="success">Published</Badge>
                    ) : (
                      <Badge tone="neutral">Draft</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-faint">
                    {done}/{m.items.length} complete
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {m.items.slice(0, 3).map((it) => {
                      const Icon = itemIcon[it.type];
                      return (
                        <li
                          key={it.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          {it.completed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Icon className="h-4 w-4 text-ink-faint" />
                          )}
                          <span
                            className={
                              it.completed
                                ? "text-ink-faint line-through"
                                : "text-ink"
                            }
                          >
                            {it.title}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="space-y-6">
        <CourseScheduleWidget course={course} meetings={meetings} />

        <OfficeHoursWidget course={course} slots={officeHours} />

        <Widget
          title="To-do"
          icon={<CalendarClock className="h-4 w-4 text-brand-600" />}
        >
          {todo.length === 0 ? (
            <p className="text-sm text-ink-faint">All caught up!</p>
          ) : (
            <ul className="space-y-3">
              {todo.map((a) => {
                const d = daysUntil(a.dueAt);
                return (
                  <li key={a.id}>
                    <Link
                      href={`/courses/${course.id}/assignments`}
                      className="block"
                    >
                      <p className="text-sm font-medium text-ink hover:text-brand-700">
                        {a.title}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {a.points} pts · {formatDateTime(a.dueAt)}
                      </p>
                    </Link>
                    {d <= 1 && (
                      <Badge tone="danger" className="mt-1">
                        {d < 0 ? "Overdue" : d === 0 ? "Due today" : "Due tomorrow"}
                      </Badge>
                    )}
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
            <p className="text-sm text-ink-faint">No announcements yet.</p>
          ) : (
            <ul className="space-y-3">
              {announcements.map((an) => (
                <li key={an.id}>
                  <p className="text-sm font-medium text-ink">{an.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {an.author} · {relativeTime(an.postedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </div>
    </div>
  );
}
