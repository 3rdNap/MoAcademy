import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { NewItemButton } from "@/components/role/NewItemButton";
import { itemIcon } from "@/lib/itemMeta";
import { getAssignments, getCourse } from "@/lib/data";
import { formatDateTime } from "@/lib/utils";
import type { SubmissionStatus } from "@/lib/types";

export const metadata = { title: "Assignments" };

const statusBadge: Record<
  SubmissionStatus,
  { tone: "neutral" | "brand" | "success" | "warning" | "danger" | "info"; label: string }
> = {
  not_started: { tone: "neutral", label: "Not started" },
  in_progress: { tone: "info", label: "In progress" },
  submitted: { tone: "brand", label: "Submitted" },
  graded: { tone: "success", label: "Graded" },
  late: { tone: "warning", label: "Late" },
  missing: { tone: "danger", label: "Missing" },
};

export default async function AssignmentsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, assignments] = await Promise.all([
    getCourse(courseId),
    getAssignments(courseId),
  ]);
  if (!course) notFound();

  const sorted = [...assignments].sort(
    (a, b) => +new Date(a.dueAt) - +new Date(b.dueAt),
  );

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle={`${assignments.length} assignments · ${assignments.reduce(
          (n, a) => n + a.points,
          0,
        )} points total`}
        action={<NewItemButton label="Assignment" />}
      />

      <div className="card divide-y divide-black/5">
        {sorted.map((a) => {
          const Icon = itemIcon[a.type];
          const badge = statusBadge[a.status];
          return (
            <div
              key={a.id}
              className="flex items-start gap-3 p-4 hover:bg-surface-subtle"
            >
              <span
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: course.color }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-ink">{a.title}</h3>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">{a.description}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  Due {formatDateTime(a.dueAt)} · {a.points} pts
                </p>
              </div>
              <div className="shrink-0 text-right">
                {a.status === "graded" && a.score != null ? (
                  <p className="text-lg font-bold text-ink">
                    {a.score}
                    <span className="text-sm font-normal text-ink-faint">
                      /{a.points}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-ink-faint">—/{a.points}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
