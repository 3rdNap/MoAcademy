import { Inbox as InboxIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { getCourses } from "@/lib/data";
import { initialsOf, relativeTime } from "@/lib/utils";

export const metadata = { title: "Inbox" };

const conversations = [
  {
    id: "m1",
    from: "Dr. Lerato Khumalo",
    courseId: "c_cs101",
    subject: "Re: Project 1 extension",
    preview: "Sure — you can submit by Friday. Let me know if you need help with the parser.",
    at: "2026-06-27T10:15:00Z",
    unread: true,
  },
  {
    id: "m2",
    from: "Dr. Amara Botha",
    courseId: "c_eng150",
    subject: "Peer review partner",
    preview: "You're paired with Thabo for Essay 2. Please exchange drafts by Monday.",
    at: "2026-06-25T09:35:00Z",
    unread: true,
  },
  {
    id: "m3",
    from: "Thabo Nkosi",
    courseId: "c_cs101",
    subject: "Study group tonight?",
    preview: "A few of us are meeting in the library at 7 to go over conditionals.",
    at: "2026-06-24T18:02:00Z",
    unread: false,
  },
];

export default async function InboxPage() {
  const courses = await getCourses();

  return (
    <>
      <PageHeader title="Inbox" subtitle="Messages from your instructors and classmates." />

      <div className="card divide-y divide-black/5">
        {conversations.map((m) => {
          const course = courses.find((c) => c.id === m.courseId);
          return (
            <div
              key={m.id}
              className="flex items-start gap-3 p-4 hover:bg-surface-subtle"
            >
              <Avatar
                initials={initialsOf(m.from)}
                color={course?.color ?? "#5d3fea"}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={
                      m.unread
                        ? "text-sm font-semibold text-ink"
                        : "text-sm font-medium text-ink-muted"
                    }
                  >
                    {m.from}
                  </p>
                  {m.unread && (
                    <span className="h-2 w-2 rounded-full bg-brand-600" />
                  )}
                  <span className="ml-auto text-xs text-ink-faint">
                    {relativeTime(m.at)}
                  </span>
                </div>
                <p className="text-sm font-medium text-ink">{m.subject}</p>
                <p className="truncate text-sm text-ink-muted">{m.preview}</p>
                {course && (
                  <p className="mt-0.5 text-xs text-ink-faint">{course.code}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {conversations.length === 0 && (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <InboxIcon className="h-8 w-8 text-ink-faint" />
          <p className="text-sm text-ink-muted">Your inbox is empty.</p>
        </div>
      )}
    </>
  );
}
