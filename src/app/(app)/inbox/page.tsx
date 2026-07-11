import {
  InboxBoard,
  type SeedConversation,
} from "@/components/inbox/InboxBoard";
import { getCourses, getCourseRoster, getCurrentUser } from "@/lib/data";
import { inboxSeed } from "@/lib/inbox-seed";
import { roster } from "@/lib/roster";

export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const [courses, user] = await Promise.all([getCourses(), getCurrentUser()]);

  const seedConversations: SeedConversation[] = inboxSeed.map((m) => {
    const course = courses.find((c) => c.id === m.courseId);
    return {
      id: m.id,
      with: m.with,
      subject: m.subject,
      preview: m.preview,
      at: m.at,
      unread: m.unread,
      courseCode: course?.code,
      color: course?.color,
    };
  });

  // Suggestions for the "To" field: course instructors + classmates. Real
  // enrolled classmates where available, else the demo roster.
  const rosters = await Promise.all(courses.map((c) => getCourseRoster(c.id)));
  const classmates = rosters.flatMap((r) =>
    r !== null ? r.map((m) => m.name) : roster.map((s) => s.name),
  );
  const recipients = Array.from(
    new Set([...courses.map((c) => c.instructor), ...classmates]),
  );

  return (
    <InboxBoard
      userName={user.name}
      seedConversations={seedConversations}
      recipients={recipients}
    />
  );
}
