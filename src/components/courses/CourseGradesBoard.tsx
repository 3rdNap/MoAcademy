"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { useLocalCollection } from "@/lib/local-store";
import { roster } from "@/lib/roster";
import { formatDate, initialsOf, letterGrade } from "@/lib/utils";
import type { Assignment, Course } from "@/lib/types";

interface GradeCell {
  id: string; // `${studentId}__${assignmentId}`
  score: number;
}

export function CourseGradesBoard({
  course,
  seed,
}: {
  course: Course;
  seed: Assignment[];
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
    return <StudentGrades course={course} assignments={assignments} />;
  }
  return <InstructorGradebook course={course} assignments={assignments} />;
}

/* ----------------------------- Student view ----------------------------- */

function StudentGrades({
  course,
  assignments,
}: {
  course: Course;
  assignments: Assignment[];
}) {
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

/* --------------------------- Instructor view ---------------------------- */

function InstructorGradebook({
  course,
  assignments,
}: {
  course: Course;
  assignments: Assignment[];
}) {
  const grades = useLocalCollection<GradeCell>(
    `moacademy.gradebook.${course.id}`,
    [],
  );

  const cellId = (sid: string, aid: string) => `${sid}__${aid}`;
  const getScore = (sid: string, aid: string) =>
    grades.items.find((g) => g.id === cellId(sid, aid))?.score;

  function setScore(sid: string, aid: string, raw: string, points: number) {
    const id = cellId(sid, aid);
    const existing = grades.items.find((g) => g.id === id);
    if (raw === "") {
      if (existing) grades.remove(id);
      return;
    }
    const score = Math.max(0, Math.min(points, Number(raw)));
    if (Number.isNaN(score)) return;
    if (existing) grades.update(id, { score });
    else grades.add({ id, score });
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
    const scores = roster
      .map((s) => getScore(s.id, aid))
      .filter((v): v is number => v != null);
    if (scores.length === 0) return null;
    const avg = scores.reduce((n, v) => n + v, 0) / scores.length;
    return Math.round((avg / points) * 100);
  }

  return (
    <>
      <PageHeader
        title="Gradebook"
        subtitle={`${roster.length} students · ${assignments.length} assignments in ${course.code}. Enter scores — they save automatically.`}
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
            {roster.map((s) => {
              const pct = studentPct(s.id);
              return (
                <tr key={s.id} className="hover:bg-surface-subtle">
                  <td className="sticky left-0 z-10 bg-surface px-4 py-2">
                    <span className="flex items-center gap-2">
                      <Avatar
                        initials={initialsOf(s.name)}
                        color="#8b94a3"
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
