import {
  InboxBoard,
  type SeedConversation,
} from "@/components/inbox/InboxBoard";
import { getCourses, getCurrentUser } from "@/lib/data";
import { roster } from "@/lib/roster";

export const metadata = { title: "Inbox" };

const seed = [
  {
    id: "m1",
    with: "Dr. Lerato Khumalo",
    courseId: "c_cs101",
    subject: "Re: Project 1 extension",
    preview:
      "Sure — you can submit by Friday. Let me know if you need help with the parser.",
    at: "2026-06-27T10:15:00Z",
    unread: true,
  },
  {
    id: "m2",
    with: "Dr. Amara Botha",
    courseId: "c_eng150",
    subject: "Peer review partner",
    preview:
      "You're paired with Thabo for Essay 2. Please exchange drafts by Monday.",
    at: "2026-06-25T09:35:00Z",
    unread: true,
  },
  {
    id: "m3",
    with: "Thabo Nkosi",
    courseId: "c_cs101",
    subject: "Study group tonight?",
    preview:
      "A few of us are meeting in the library at 7 to go over conditionals.",
    at: "2026-06-24T18:02:00Z",
    unread: false,
  },
];

export default async function InboxPage() {
  const [courses, user] = await Promise.all([getCourses(), getCurrentUser()]);

  const seedConversations: SeedConversation[] = seed.map((m) => {
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
