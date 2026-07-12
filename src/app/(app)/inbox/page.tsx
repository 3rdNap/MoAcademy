import {
  InboxBoard,
  type SeedConversation,
} from "@/components/inbox/InboxBoard";
import {
  getAuthState,
  getCourses,
  getCurrentUser,
  getMessageContacts,
} from "@/lib/data";
import { inboxSeed } from "@/lib/inbox-seed";
import { roster } from "@/lib/roster";

export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const [courses, user, contacts, auth] = await Promise.all([
    getCourses(),
    getCurrentUser(),
    getMessageContacts(),
    getAuthState(),
  ]);

  // Demo conversations are for the anonymous demo only — signed-in users see
  // just their real threads.
  const seedSource = auth.authed ? [] : inboxSeed;
  const seedConversations: SeedConversation[] = seedSource.map((m) => {
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

  // Suggestions for the "To" field: real course-mates when signed in, else
  // the demo instructors + fake roster names.
  const recipients =
    contacts ??
    Array.from(
      new Set([
        ...courses.map((c) => c.instructor),
        ...roster.map((s) => s.name),
      ]),
    ).map((name) => ({ name }));

  return (
    <InboxBoard
      userName={user.name}
      seedConversations={seedConversations}
      recipients={recipients}
    />
  );
}
