import { notFound } from "next/navigation";
import { CheckCircle2, Clock, Lock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { itemIcon, itemLabel } from "@/lib/itemMeta";
import { getCourse, getModules } from "@/lib/data";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Modules" };

export default async function ModulesPage({
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

  return (
    <>
      <PageHeader title="Modules" subtitle="Work through each module in order." />

      <div className="space-y-4">
        {modules.map((m) => (
          <section key={m.id} className="card overflow-hidden">
            <header className="flex items-center justify-between gap-2 bg-surface-subtle px-4 py-3">
              <h2 className="flex items-center gap-2 font-semibold text-ink">
                {!m.published && <Lock className="h-4 w-4 text-ink-faint" />}
                {m.title}
              </h2>
              {m.published ? (
                <Badge tone="success">Published</Badge>
              ) : (
                <Badge tone="neutral">Locked</Badge>
              )}
            </header>
            <ul className="divide-y divide-black/5">
              {m.items.map((it) => {
                const Icon = itemIcon[it.type];
                return (
                  <li
                    key={it.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-subtle"
                    style={{ paddingLeft: 16 + (it.indent ?? 0) * 20 }}
                  >
                    <span className="shrink-0">
                      {it.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Icon className="h-5 w-5 text-ink-faint" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          it.completed
                            ? "text-sm text-ink-muted"
                            : "text-sm font-medium text-ink"
                        }
                      >
                        {it.title}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {itemLabel[it.type]}
                        {it.durationMin ? ` · ${it.durationMin} min` : ""}
                        {it.dueAt ? ` · Due ${formatDateTime(it.dueAt)}` : ""}
                      </p>
                    </div>
                    {it.dueAt && !it.completed && (
                      <span className="hidden items-center gap-1 text-xs text-ink-faint sm:flex">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDateTime(it.dueAt)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
