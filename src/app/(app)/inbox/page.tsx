import {
  InboxBoard,
  type SeedConversation,
} from "@/components/inbox/InboxBoard";
import { getAuthState, getContacts, getCourses, getCurrentUser } from "@/lib/data";
import { inboxSeed } from "@/lib/inbox-seed";
import { roster } from "@/lib/roster";

export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const [courses, user, contacts, { authed }] = await Promise.all([
    getCourses(),
    getCurrentUser(),
    getContacts(),
    getAuthState(),
  ]);

  // Demo threads are for the anonymous tour only — a signed-in user's inbox
  // starts empty and fills with their own conversations.
  const seedConversations: SeedConversation[] = authed
    ? []
    : inboxSeed.map((m) => {
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

  // Suggestions for the "To" field: the real people they share a subject with
  // when signed in, the demo class otherwise.
  const recipients = authed
    ? contacts.map((c) => c.name)
    : Array.from(
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
