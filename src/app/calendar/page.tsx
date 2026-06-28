import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { getCalendar, getCourses } from "@/lib/data";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Calendar" };

const typeTone = {
  assignment: "brand",
  quiz: "info",
  event: "neutral",
  office_hours: "success",
} as const;

export default async function CalendarPage() {
  const [events, courses] = await Promise.all([getCalendar(), getCourses()]);

  // Group by day.
  const byDay = events
    .slice()
    .sort((a, b) => +new Date(a.at) - +new Date(b.at))
    .reduce<Record<string, typeof events>>((acc, ev) => {
      const day = new Date(ev.at).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      (acc[day] ??= []).push(ev);
      return acc;
    }, {});

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Everything due across your courses, in one agenda."
      />

      <div className="space-y-6">
        {Object.entries(byDay).map(([day, list]) => (
          <section key={day}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarClock className="h-4 w-4 text-brand-600" />
              {day}
            </h2>
            <div className="card divide-y divide-black/5">
              {list.map((ev) => {
                const course = courses.find((c) => c.id === ev.courseId);
                return (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 p-3.5 hover:bg-surface-subtle"
                  >
                    <span
                      className="h-10 w-1.5 rounded-full"
                      style={{ backgroundColor: course?.color ?? "#8b94a3" }}
                    />
                    <div className="min-w-0 flex-1">
                      {ev.courseId ? (
                        <Link
                          href={`/courses/${ev.courseId}`}
                          className="text-sm font-medium text-ink hover:text-brand-700"
                        >
                          {ev.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-ink">{ev.title}</p>
                      )}
                      <p className="text-xs text-ink-faint">
                        {course?.code ?? "Personal"} · {formatDateTime(ev.at)}
                      </p>
                    </div>
                    <Badge tone={typeTone[ev.type]}>
                      {ev.type.replace("_", " ")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
