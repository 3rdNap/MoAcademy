import { CalendarBoard } from "@/components/calendar/CalendarBoard";
import {
  getAuthState,
  getCalendar,
  getChildCourses,
  getCourses,
  getGuardianChildren,
  getWorkFor,
} from "@/lib/data";
import type { CalendarEvent } from "@/lib/types";

export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const auth = await getAuthState();

  // A guardian's calendar is their children's deadlines, read-only — they
  // follow the schedule rather than keeping their own events against it.
  if (auth.authed && auth.role === "parent") {
    const children = await getGuardianChildren();
    const perChild = await Promise.all(
      children.map(async (child) => {
        const courses = await getChildCourses(child.id);
        const work = await getWorkFor(child.id, courses);
        const first = child.name.split(" ")[0] || child.email;
        const events: CalendarEvent[] = work.map((w) => ({
          id: `${child.id}-${w.assignment.id}`,
          courseId: w.assignment.courseId,
          title:
            children.length > 1
              ? `${first} · ${w.assignment.title}`
              : w.assignment.title,
          at: w.assignment.dueAt,
          type: w.assignment.type === "quiz" ? "quiz" : "assignment",
        }));
        return { events, courses };
      }),
    );

    return (
      <CalendarBoard
        readOnly
        title="Calendar"
        subtitle={
          children.length === 1
            ? `Everything due for ${children[0].name.split(" ")[0] || "your child"}.`
            : "Everything due across your children's subjects."
        }
        seedEvents={perChild.flatMap((p) => p.events)}
        courses={perChild.flatMap((p) => p.courses)}
      />
    );
  }

  const [events, courses] = await Promise.all([getCalendar(), getCourses()]);
  return <CalendarBoard seedEvents={events} courses={courses} />;
}
