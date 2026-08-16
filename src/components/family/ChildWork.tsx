"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ChildPicker } from "@/components/family/ChildPicker";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { GuardianChild, SubmissionStatus, WorkItem } from "@/lib/data";

export interface ChildWorkView {
  child: GuardianChild;
  work: WorkItem[];
}

/** How each state reads to a parent — plain language, not LMS jargon. */
const STATUS: Record<
  SubmissionStatus,
  { tone: "neutral" | "success" | "warning" | "danger" | "info"; label: string }
> = {
  graded: { tone: "success", label: "Marked" },
  submitted: { tone: "success", label: "Handed in" },
  in_progress: { tone: "info", label: "Started" },
  not_started: { tone: "neutral", label: "Not handed in" },
  late: { tone: "warning", label: "Late" },
  missing: { tone: "danger", label: "Missing" },
};

/**
 * A guardian's read-only view of a child's schoolwork: everything scheduled,
 * and whether it has been handed in. There are no actions here by design — a
 * parent follows the work, they don't submit or change it.
 */
export function ChildWork({ views }: { views: ChildWorkView[] }) {
  const [childId, setChildId] = useState(views[0]?.child.id ?? "");
  const current = views.find((v) => v.child.id === childId) ?? views[0];

  if (!current) {
    return (
      <>
        <PageHeader title="Schoolwork" subtitle="Track what's due and what's been handed in." />
        <EmptyCard>
          No linked students yet. Once the school links your child&apos;s
          account to yours, their work appears here.
        </EmptyCard>
      </>
    );
  }

  const { child, work } = current;
  const outstanding = work.filter(
    (w) => w.status !== "submitted" && w.status !== "graded",
  );
  const overdue = outstanding.filter((w) => w.overdue);
  const firstName = child.name.split(" ")[0] || "your child";

  return (
    <>
      <PageHeader
        title="Schoolwork"
        subtitle={`Everything scheduled for ${firstName}, and whether it's been handed in.`}
      />

      {views.length > 1 && (
        <ChildPicker views={views} childId={current.child.id} onSelect={setChildId} />
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tally label="Scheduled" value={work.length} />
        <Tally label="Handed in" value={work.length - outstanding.length} tone="text-emerald-600" />
        <Tally label="Still to do" value={outstanding.length} tone="text-amber-600" />
        <Tally label="Overdue" value={overdue.length} tone={overdue.length ? "text-rose-600" : undefined} />
      </div>

      {work.length === 0 ? (
        <EmptyCard>
          Nothing has been set yet. Assignments appear here as {firstName}&apos;s
          teachers publish them.
        </EmptyCard>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-surface-subtle text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3 font-semibold">Assignment</th>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold">Due</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Mark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {work.map((w) => {
                const badge = w.overdue
                  ? STATUS.missing
                  : STATUS[w.status] ?? STATUS.not_started;
                return (
                  <tr key={w.assignment.id} className="hover:bg-surface-subtle">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{w.assignment.title}</p>
                      {w.submittedAt && (
                        <p className="text-xs text-ink-faint">
                          Handed in {formatDateTime(w.submittedAt)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-ink-muted">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: w.courseColor }}
                        />
                        {w.courseCode || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {formatDate(w.assignment.dueAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-ink">
                      {w.score != null
                        ? `${w.score}/${w.assignment.points}`
                        : <span className="text-ink-faint">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-faint">
        This view is read-only — only {firstName} can hand work in.
      </p>
    </>
  );
}

function Tally({
  label,
  value,
  tone = "text-ink",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="card p-3">
      <p className={`text-lg font-bold leading-none ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{label}</p>
    </div>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
        <ClipboardList className="h-6 w-6" />
      </span>
      <p className="max-w-sm text-sm text-ink-muted">{children}</p>
    </div>
  );
}
