// Shared seed conversations, used by the Inbox page and the notification bell
// (so the unread count stays consistent between them).

export interface InboxSeed {
  id: string;
  with: string;
  courseId: string;
  subject: string;
  preview: string;
  at: string;
  unread: boolean;
}

export const inboxSeed: InboxSeed[] = [
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
