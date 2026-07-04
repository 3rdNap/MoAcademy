import {
  InboxBoard,
  type SeedConversation,
} from "@/components/inbox/InboxBoard";
import { getCourses, getCurrentUser } from "@/lib/data";
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

  // Suggestions for the "To" field: course instructors + classmates.
  const recipients = Array.from(
    new Set([
      ...courses.map((c) => c.instructor),
      ...roster.map((s) => s.name),
    ]),
  );

  return (
    <InboxBoard
      userName={user.name}
      seedConversations={seedConversations}
      recipients={recipients}
    />
  );
}
