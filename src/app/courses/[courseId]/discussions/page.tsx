import { notFound } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { getCourse, getModules } from "@/lib/data";
import { formatDateTime, relativeTime } from "@/lib/utils";

export const metadata = { title: "Discussions" };

export default async function DiscussionsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, modules] = await Promise.all([
    getCourse(courseId),
    getModules(courseId),
  ]);
  if (!course) notFound();

  // Surface discussion-type module items as threads.
  const threads = modules.flatMap((m) =>
    m.items
      .filter((i) => i.type === "discussion")
      .map((i) => ({ ...i, module: m.title })),
  );

  return (
    <>
      <PageHeader
        title="Discussions"
        subtitle={`${threads.length} discussion topics.`}
      />

      {threads.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <MessageSquare className="h-8 w-8 text-ink-faint" />
          <p className="text-sm text-ink-muted">No discussions yet.</p>
        </div>
      ) : (
        <div className="card divide-y divide-black/5">
          {threads.map((t, i) => (
            <div
              key={t.id}
              className="flex items-start gap-3 p-4 hover:bg-surface-subtle"
            >
              <span
                className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: course.color }}
              >
                <MessageSquare className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-ink">{t.title}</h3>
                  {i === 0 && <Badge tone="brand">2 new</Badge>}
                </div>
                <p className="text-xs text-ink-faint">{t.module}</p>
                {t.dueAt && (
                  <p className="mt-1 text-xs text-ink-faint">
                    Due {formatDateTime(t.dueAt)}
                  </p>
                )}
              </div>
              <span className="hidden text-xs text-ink-faint sm:block">
                {t.dueAt ? relativeTime(t.dueAt) : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
