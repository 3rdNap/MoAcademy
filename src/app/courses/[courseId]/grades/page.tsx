import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { getAssignments, getCourse } from "@/lib/data";
import { formatDate, letterGrade } from "@/lib/utils";

export const metadata = { title: "Grades" };

export default async function CourseGradesPage({
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

  const graded = assignments.filter(
    (a) => a.status === "graded" && a.score != null,
  );
  const earned = graded.reduce((n, a) => n + (a.score ?? 0), 0);
  const possible = graded.reduce((n, a) => n + a.points, 0);
  const pct = possible ? Math.round((earned / possible) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Grades"
        subtitle={`Based on ${graded.length} graded items in ${course.code}.`}
        action={
          <div
            className="rounded-xl px-4 py-2 text-right text-white shadow-card"
            style={{ backgroundColor: course.color }}
          >
            <p className="text-2xl font-bold leading-none">
              {pct}% <span className="text-base font-medium">·</span>{" "}
              {letterGrade(pct)}
            </p>
            <p className="text-xs text-white/85">
              {earned}/{possible} points
            </p>
          </div>
        }
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 bg-surface-subtle text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3 font-semibold">Assignment</th>
              <th className="px-4 py-3 font-semibold">Due</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {assignments.map((a) => (
              <tr key={a.id} className="hover:bg-surface-subtle">
                <td className="px-4 py-3 font-medium text-ink">{a.title}</td>
                <td className="px-4 py-3 text-ink-muted">
                  {formatDate(a.dueAt)}
                </td>
                <td className="px-4 py-3">
                  {a.status === "graded" ? (
                    <Badge tone="success">Graded</Badge>
                  ) : a.status === "missing" ? (
                    <Badge tone="danger">Missing</Badge>
                  ) : (
                    <Badge tone="neutral">Pending</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-ink">
                  {a.score != null ? `${a.score}/${a.points}` : `—/${a.points}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
