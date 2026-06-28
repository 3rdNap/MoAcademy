import { notFound } from "next/navigation";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { getAnnouncements, getCourse } from "@/lib/data";
import { formatDateTime, initialsOf } from "@/lib/utils";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, announcements] = await Promise.all([
    getCourse(courseId),
    getAnnouncements(courseId),
  ]);
  if (!course) notFound();

  return (
    <>
      <PageHeader title="Announcements" subtitle={`Updates from ${course.code}.`} />

      {announcements.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <Megaphone className="h-8 w-8 text-ink-faint" />
          <p className="text-sm text-ink-muted">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((an) => (
            <article key={an.id} className="card p-5">
              <div className="flex items-center gap-3">
                <Avatar initials={initialsOf(an.author)} color={course.color} />
                <div>
                  <h2 className="font-semibold text-ink">{an.title}</h2>
                  <p className="text-xs text-ink-faint">
                    {an.author} · {formatDateTime(an.postedAt)}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                {an.body}
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
