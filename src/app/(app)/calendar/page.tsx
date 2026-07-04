import { CalendarBoard } from "@/components/calendar/CalendarBoard";
import { getCalendar, getCourses } from "@/lib/data";

export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const [events, courses] = await Promise.all([getCalendar(), getCourses()]);
  return <CalendarBoard seedEvents={events} courses={courses} />;
}
