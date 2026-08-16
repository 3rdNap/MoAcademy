"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { useLocalCollection } from "@/lib/local-store";
import { fetchCourseMarks, saveMark, type MarkRow } from "@/lib/course-content-db";
import { roster } from "@/lib/roster";
import { formatDate, initialsOf, letterGrade } from "@/lib/utils";
import type { Assignment, Course } from "@/lib/types";

interface GradeCell {
  id: string; // `${studentId}__${assignmentId}`
  score: number;
}

/** A student to grade — a real enrolment, or a demo one for anonymous visits. */
export interface GradebookStudent {
  id: string;
  name: string;
  avatarColor: string;
}

/** What was actually recorded for the signed-in student, by assignment id. */
export type MyMarks = Record<
  string,
  { score: number | null; status: string }
> | null;

export function CourseGradesBoard({
  course,
  seed,
  students,
  myMarks = null,
}: {
  course: Course;
  seed: Assignment[];
  /** The enrolled class; `null` falls back to the demo roster. */
  students?: GradebookStudent[] | null;
  /** The viewer's own marks; `null` falls back to the seed status. */
  myMarks?: MyMarks;
}) {
  const { role, hydrated } = useRole();
  const teaching = hydrated && canTeach(role);

  const authored = useLocalCollection<Assignment>(
    `moacademy.authoring.assignments.${course.id}`,
    [],
  );

  const assignments = useMemo(
    () =>
      [...seed, ...authored.items].sort(
        (a, b) => +new Date(a.dueAt) - +new Date(b.dueAt),
      ),
    [seed, authored.items],
  );

  if (!teaching) {
    return (
      <StudentGrades
        course={course}
        assignments={assignments}
        myMarks={myMarks}
      />
    );
  }
  return (
    <InstructorGradebook
      course={course}
      assignments={assignments}
      students={
        students === undefined || students === null
          ? roster.map((s) => ({ ...s, avatarColor: "#8b94a3" }))
          : students
      }
    />
  );
}

/* ----------------------------- Student view ----------------------------- */

function StudentGrades({
  course,
  assignments,
  myMarks,
}: {
  course: Course;
  assignments: Assignment[];
  myMarks: MyMarks;
}) {
  // Prefer what was recorded for this student; the assignment's own status is
  // only meaningful in the anonymous demo, where nobody has submissions.
  const scoreOf = (a: Assignment) =>
    myMarks ? myMarks[a.id]?.score ?? null : a.score ?? null;
  const statusOf = (a: Assignment) =>
    myMarks ? myMarks[a.id]?.status ?? "not_started" : a.status;

  const graded = assignments.filter((a) => scoreOf(a) != null);
  const earned = graded.reduce((n, a) => n + (scoreOf(a) ?? 0), 0);
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
              {pct}% · {letterGrade(pct)}
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
                <td className="px-4 py-3 text-ink-muted">{formatDate(a.dueAt)}</td>
                <td className="px-4 py-3">
                  {statusOf(a) === "graded" ? (
                    <Badge tone="success">Graded</Badge>
                  ) : statusOf(a) === "missing" ? (
                    <Badge tone="danger">Missing</Badge>
                  ) : statusOf(a) === "submitted" ? (
                    <Badge tone="info">Submitted</Badge>
                  ) : (
                    <Badge tone="neutral">Pending</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-ink">
                  {scoreOf(a) != null
                    ? `${scoreOf(a)}/${a.points}`
                    : `—/${a.points}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* --------------------------- Instructor view ---------------------------- */

function InstructorGradebook({
  course,
  assignments,
  students,
}: {
  course: Course;
  assignments: Assignment[];
  students: GradebookStudent[];
}) {
  const grades = useLocalCollection<GradeCell>(
    `moacademy.gradebook.${course.id}`,
    [],
  );

  // Marks belong in the database: a score entered here is what the student's
  // own grade page and their guardian's view read (0020). The browser copy is
  // the fallback for the no-backend demo, where there are no real students to
  // mark anyway.
  const [marks, setMarks] = useState<MarkRow[] | null>(null);
  const assignmentIds = useMemo(() => assignments.map((a) => a.id), [assignments]);
  useEffect(() => {
    let alive = true;
    fetchCourseMarks(assignmentIds).then((m) => alive && setMarks(m));
    return () => {
      alive = false;
    };
  }, [assignmentIds]);

  const cellId = (sid: string, aid: string) => `${sid}__${aid}`;

  const getScore = useCallback(
    (sid: string, aid: string): number | undefined => {
      if (marks) {
        return (
          marks.find((m) => m.studentId === sid && m.assignmentId === aid)
            ?.score ?? undefined
        );
      }
      return grades.items.find((g) => g.id === cellId(sid, aid))?.score;
    },
    [marks, grades.items],
  );

  async function setScore(sid: string, aid: string, raw: string, points: number) {
    const id = cellId(sid, aid);
    const cleared = raw === "";
    const score = cleared
      ? null
      : Math.max(0, Math.min(points, Number(raw)));
    if (score != null && Number.isNaN(score)) return;

    if (marks) {
      // Optimistic: the cell should respond as fast as it's typed in. Keep the
      // rest of the row (the work itself) so marking never blanks a submission.
      setMarks((prev) => {
        const rows = prev ?? [];
        const existing = rows.find(
          (m) => m.studentId === sid && m.assignmentId === aid,
        );
        return [
          ...rows.filter(
            (m) => !(m.studentId === sid && m.assignmentId === aid),
          ),
          {
            body: "",
            attachmentName: null,
            submittedAt: null,
            ...existing,
            assignmentId: aid,
            studentId: sid,
            score,
            status: (score == null ? "submitted" : "graded") as MarkRow["status"],
          },
        ];
      });
      const ok = await saveMark({ assignmentId: aid, studentId: sid, score });
      if (ok) return;
      // The write was refused — reload rather than leave a mark on screen
      // that was never actually recorded.
      fetchCourseMarks(assignmentIds).then(setMarks);
      return;
    }

    const existing = grades.items.find((g) => g.id === id);
    if (cleared) {
      if (existing) grades.remove(id);
      return;
    }
    if (existing) grades.update(id, { score: score as number });
    else grades.add({ id, score: score as number });
  }

  function studentPct(sid: string) {
    let earned = 0;
    let possible = 0;
    for (const a of assignments) {
      const s = getScore(sid, a.id);
      if (s != null) {
        earned += s;
        possible += a.points;
      }
    }
    return possible ? Math.round((earned / possible) * 100) : null;
  }

  function assignmentAvg(aid: string, points: number) {
    const scores = students
      .map((s) => getScore(s.id, aid))
      .filter((v): v is number => v != null);
    if (scores.length === 0) return null;
    const avg = scores.reduce((n, v) => n + v, 0) / scores.length;
    return Math.round((avg / points) * 100);
  }

  if (students.length === 0) {
    return (
      <>
        <PageHeader
          title="Gradebook"
          subtitle={`${assignments.length} assignments in ${course.code}.`}
        />
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <p className="font-semibold text-ink">No students enrolled yet</p>
            <p className="mt-1 text-sm text-ink-muted">
              Once an administrator enrols students into {course.code}, they
              appear here with a column for every assignment.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Gradebook"
        subtitle={`${students.length} ${
          students.length === 1 ? "student" : "students"
        } · ${assignments.length} assignments in ${course.code}. Enter scores — they save automatically.`}
      />

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/5 bg-surface-subtle text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="sticky left-0 z-10 bg-surface-subtle px-4 py-3 font-semibold">
                Student
              </th>
              {assignments.map((a) => (
                <th key={a.id} className="px-3 py-3 font-semibold">
                  <span className="block max-w-[8rem] truncate text-ink">
                    {a.title}
                  </span>
                  <span className="font-normal text-ink-faint">
                    /{a.points}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {students.map((s) => {
              const pct = studentPct(s.id);
              return (
                <tr key={s.id} className="hover:bg-surface-subtle">
                  <td className="sticky left-0 z-10 bg-surface px-4 py-2">
                    <span className="flex items-center gap-2">
                      <Avatar
                        initials={initialsOf(s.name)}
                        color={s.avatarColor}
                        size={28}
                      />
                      <span className="whitespace-nowrap text-sm font-medium text-ink">
                        {s.name}
                      </span>
                    </span>
                  </td>
                  {assignments.map((a) => (
                    <td key={a.id} className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={a.points}
                        value={getScore(s.id, a.id) ?? ""}
                        onChange={(e) =>
                          setScore(s.id, a.id, e.target.value, a.points)
                        }
                        placeholder="—"
                        className="focus-ring h-9 w-16 rounded-lg border border-black/10 bg-surface px-2 text-center text-sm text-ink placeholder:text-ink-faint"
                        aria-label={`${s.name} — ${a.title}`}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right">
                    {pct != null ? (
                      <span className="font-semibold text-ink">
                        {pct}%{" "}
                        <span className="text-xs font-normal text-ink-faint">
                          {letterGrade(pct)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-black/5 bg-surface-subtle text-xs">
              <td className="sticky left-0 z-10 bg-surface-subtle px-4 py-2 font-semibold uppercase tracking-wide text-ink-faint">
                Class average
              </td>
              {assignments.map((a) => {
                const avg = assignmentAvg(a.id, a.points);
                return (
                  <td key={a.id} className="px-3 py-2 text-ink-muted">
                    {avg != null ? `${avg}%` : "—"}
                  </td>
                );
              })}
              <td className="px-4 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        Scores are capped at each assignment&apos;s points and saved in your
        browser. Switch to the Student view (top bar) to see the learner&apos;s
        own grade page.
      </p>
    </>
  );
}
