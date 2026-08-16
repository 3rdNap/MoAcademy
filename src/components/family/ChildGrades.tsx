"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { ChildPicker } from "@/components/family/ChildPicker";
import { letterGrade } from "@/lib/utils";
import type { GuardianChild } from "@/lib/data";

export interface SubjectGrade {
  courseId: string;
  name: string;
  code: string;
  color: string;
  /** Percent across marked work, or null when nothing is marked yet. */
  pct: number | null;
  marked: number;
}

export interface ChildGradesView {
  child: GuardianChild;
  subjects: SubjectGrade[];
  overall: number | null;
}

/**
 * A guardian's read-only grade view: each subject's standing from the child's
 * marked submissions. Unlike the student's own page these rows don't link into
 * the course — a guardian follows the outcome, not the coursework itself.
 */
export function ChildGrades({ views }: { views: ChildGradesView[] }) {
  const [childId, setChildId] = useState(views[0]?.child.id ?? "");
  const current = views.find((v) => v.child.id === childId) ?? views[0];

  if (!current) {
    return (
      <>
        <PageHeader title="Grades" subtitle="How your child is doing this term." />
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <GraduationCap className="h-6 w-6" />
          </span>
          <p className="max-w-sm text-sm text-ink-muted">
            No linked students yet. Grades appear here once the school links
            your child&apos;s account to yours.
          </p>
        </div>
      </>
    );
  }

  const { child, subjects, overall } = current;
  const firstName = child.name.split(" ")[0] || "your child";

  return (
    <>
      <PageHeader
        title="Grades"
        subtitle={`${firstName}'s standing across every subject this term.`}
        action={
          overall != null ? (
            <div className="rounded-xl bg-brand-600 px-4 py-2 text-right text-white shadow-card">
              <p className="text-2xl font-bold leading-none">
                {overall}% · {letterGrade(overall)}
              </p>
              <p className="text-xs text-white/85">Term average</p>
            </div>
          ) : undefined
        }
      />

      <ChildPicker views={views} childId={current.child.id} onSelect={setChildId} />

      {subjects.length === 0 ? (
        <div className="card p-6 text-sm text-ink-muted">
          {firstName} isn&apos;t enrolled in any subjects yet.
        </div>
      ) : (
        <div className="card divide-y divide-black/5">
          {subjects.map((s) => (
            <div key={s.courseId} className="flex items-center gap-4 p-4">
              <span
                className="h-10 w-1.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-ink">{s.name}</p>
                  <span className="text-xs text-ink-faint">{s.code}</span>
                </div>
                <div className="mt-2 max-w-md">
                  <ProgressBar value={s.pct ?? 0} color={s.color} />
                </div>
                <p className="mt-1 text-xs text-ink-faint">
                  {s.marked} marked {s.marked === 1 ? "item" : "items"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {s.pct != null ? (
                  <>
                    <p className="text-xl font-bold text-ink">{s.pct}%</p>
                    <Badge tone="success">{letterGrade(s.pct)}</Badge>
                  </>
                ) : (
                  <Badge tone="neutral">Not marked yet</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
