"use client";

import { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { fetchCourseMarks, saveMark, type MarkRow } from "@/lib/course-content-db";
import { formatDateTime, initialsOf } from "@/lib/utils";
import type { Assignment } from "@/lib/types";

export interface ReviewStudent {
  id: string;
  name: string;
  avatarColor: string;
}

/**
 * What an instructor needs after work comes in: who handed it in, what they
 * actually wrote, and a place to mark it. Before this the submission body was
 * stored and never shown — marks were entered against a name and a number.
 */
export function SubmissionsReview({
  assignment,
  students,
  onClose,
}: {
  assignment: Assignment;
  students: ReviewStudent[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<MarkRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCourseMarks([assignment.id]).then((r) => alive && setRows(r ?? []));
    return () => {
      alive = false;
    };
  }, [assignment.id]);

  const rowFor = (studentId: string) =>
    rows?.find((r) => r.studentId === studentId);

  async function mark(studentId: string, raw: string) {
    const score =
      raw === "" ? null : Math.max(0, Math.min(assignment.points, Number(raw)));
    if (score != null && Number.isNaN(score)) return;

    setBusy(studentId);
    setRows((prev) => {
      const list = prev ?? [];
      const existing = list.find((r) => r.studentId === studentId);
      return [
        ...list.filter((r) => r.studentId !== studentId),
        {
          body: "",
          attachmentName: null,
          submittedAt: null,
          ...existing,
          assignmentId: assignment.id,
          studentId,
          score,
          status: (score == null ? "submitted" : "graded") as MarkRow["status"],
        },
      ];
    });
    const ok = await saveMark({ assignmentId: assignment.id, studentId, score });
    if (!ok) {
      const fresh = await fetchCourseMarks([assignment.id]);
      setRows(fresh ?? []);
    }
    setBusy(null);
  }

  const handedIn = students.filter((s) => {
    const r = rowFor(s.id);
    return r && (r.status === "submitted" || r.status === "graded");
  }).length;

  return (
    <Modal
      open
      onClose={onClose}
      title={assignment.title}
      description={`${handedIn} of ${students.length} handed in · out of ${assignment.points}`}
    >
      {rows === null ? (
        <p className="p-4 text-sm text-ink-faint">Loading submissions…</p>
      ) : students.length === 0 ? (
        <p className="p-4 text-sm text-ink-muted">
          No students are enrolled in this subject yet.
        </p>
      ) : (
        <div className="max-h-[60vh] divide-y divide-black/5 overflow-y-auto">
          {students.map((s) => {
            const r = rowFor(s.id);
            const inHand = r?.status === "submitted" || r?.status === "graded";
            return (
              <div key={s.id} className="py-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    initials={initialsOf(s.name)}
                    color={s.avatarColor}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {s.name}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {r?.submittedAt
                        ? `Handed in ${formatDateTime(r.submittedAt)}`
                        : "Nothing handed in"}
                    </p>
                  </div>
                  {r?.status === "graded" ? (
                    <Badge tone="success">Marked</Badge>
                  ) : inHand ? (
                    <Badge tone="info">Handed in</Badge>
                  ) : (
                    <Badge tone="neutral">Missing</Badge>
                  )}
                  <input
                    type="number"
                    min={0}
                    max={assignment.points}
                    defaultValue={r?.score ?? ""}
                    disabled={busy === s.id}
                    onBlur={(e) => mark(s.id, e.target.value)}
                    placeholder="—"
                    aria-label={`Mark for ${s.name}`}
                    className="focus-ring h-9 w-16 shrink-0 rounded-lg border border-black/10 bg-surface px-2 text-center text-sm text-ink placeholder:text-ink-faint disabled:opacity-50 dark:border-white/10"
                  />
                </div>

                {r?.body ? (
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-subtle p-3 text-sm text-ink-muted">
                    {r.body}
                  </p>
                ) : null}
                {r?.attachmentName && (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-ink-faint">
                    <Paperclip className="h-3.5 w-3.5" />
                    {r.attachmentName}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs text-ink-faint">
        Marks save as you leave each box, and reach the student and their
        guardian straight away. Clear a box to un-mark the work.
      </p>
    </Modal>
  );
}
