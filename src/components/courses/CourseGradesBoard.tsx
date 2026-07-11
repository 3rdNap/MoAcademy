"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { useLocalCollection } from "@/lib/local-store";
import { roster as fakeRoster } from "@/lib/roster";
import {
  fetchCourseRoster,
  fetchCourseSubmissions,
  fetchMySubmissions,
  upsertGrade,
  type RemoteSubmission,
  type RosterStudent,
} from "@/lib/gradebook-db";
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
  // Real submissions override the seed/local status+score where present; ids
  // that aren't real assignment rows just won't match anything.
  const [mySubs, setMySubs] = useState<Record<string, RemoteSubmission>>({});
  useEffect(() => {
    let alive = true;
    fetchMySubmissions(assignments.map((a) => a.id)).then((subs) => {
      if (!alive || !subs) return;
      setMySubs(Object.fromEntries(subs.map((s) => [s.assignmentId, s])));
    });
    return () => {
      alive = false;
    };
  }, [assignments]);

  function effective(a: Assignment) {
    const sub = mySubs[a.id];
    if (!sub) return { status: a.status, score: a.score };
    return { status: sub.status, score: sub.score ?? undefined };
  }

  const graded = assignments.filter((a) => {
    const e = effective(a);
    return e.status === "graded" && e.score != null;
  });
  const earned = graded.reduce((n, a) => n + (effective(a).score ?? 0), 0);
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
            {assignments.map((a) => {
              const e = effective(a);
              return (
                <tr key={a.id} className="hover:bg-surface-subtle">
                  <td className="px-4 py-3 font-medium text-ink">{a.title}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {formatDate(a.dueAt)}
                  </td>
                  <td className="px-4 py-3">
                    {e.status === "graded" ? (
                      <Badge tone="success">Graded</Badge>
                    ) : e.status === "missing" ? (
                      <Badge tone="danger">Missing</Badge>
                    ) : (
                      <Badge tone="neutral">Pending</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-ink">
                    {e.score != null ? `${e.score}/${a.points}` : `—/${a.points}`}
                  </td>
                </tr>
              );
            })}
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

  // The real enrolled class + their real submissions, for a signed-in teaching
  // account. Falls back to the fake demo roster/local grades when null/empty
  // (offline, anonymous, or not a teaching account for this course).
  const [realRoster, setRealRoster] = useState<RosterStudent[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchCourseRoster(course.id).then((r) => alive && setRealRoster(r));
    return () => {
      alive = false;
    };
  }, [course.id]);

  const realMode = Boolean(realRoster && realRoster.length > 0);
  const activeRoster: { id: string; name: string }[] = realMode
    ? realRoster!
    : fakeRoster;

  const cellId = (sid: string, aid: string) => `${sid}__${aid}`;

  const [realScores, setRealScores] = useState<Record<string, number | null>>(
    {},
  );
  useEffect(() => {
    if (!realMode) return;
    let alive = true;
    fetchCourseSubmissions(assignments.map((a) => a.id)).then((subs) => {
      if (!alive || !subs) return;
      setRealScores(
        Object.fromEntries(
          subs.map((s) => [cellId(s.userId, s.assignmentId), s.score]),
        ),
      );
    });
    return () => {
      alive = false;
    };
  }, [realMode, assignments]);

  const getScore = (sid: string, aid: string): number | undefined =>
    realMode
      ? realScores[cellId(sid, aid)] ?? undefined
      : grades.items.find((g) => g.id === cellId(sid, aid))?.score;

  async function setScore(sid: string, aid: string, raw: string, points: number) {
    if (realMode) {
      const score = raw === "" ? null : Math.max(0, Math.min(points, Number(raw)));
      if (score !== null && Number.isNaN(score)) return;
      setRealScores((prev) => ({ ...prev, [cellId(sid, aid)]: score }));
      await upsertGrade(aid, sid, { score });
      return;
    }
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
    const scores = activeRoster
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
        subtitle={`${activeRoster.length} students · ${assignments.length} assignments in ${course.code}. Enter scores — they save automatically.`}
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
            {activeRoster.map((s) => {
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
        {realMode
          ? "Scores are capped at each assignment's points and saved to each student's real gradebook."
          : "Scores are capped at each assignment's points and saved in your browser."}{" "}
        Switch to the Student view (top bar) to see the learner&apos;s own grade
        page.
      </p>
    </>
  );
}
