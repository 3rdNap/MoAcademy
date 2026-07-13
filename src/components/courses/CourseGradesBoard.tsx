"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, MessageSquareText, Paperclip } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { useLocalCollection } from "@/lib/local-store";
import {
  fetchAssignmentGroups,
  type AssignmentGroup,
} from "@/lib/course-content-db";
import { roster as fakeRoster } from "@/lib/roster";
import {
  fetchCourseRoster,
  fetchCourseSubmissions,
  fetchMySubmissions,
  fetchRubrics,
  fetchRubricScores,
  getSubmissionFileUrl,
  upsertGrade,
  upsertRubricScore,
  type RemoteSubmission,
  type RosterStudent,
  type RubricCriterion,
} from "@/lib/gradebook-db";
import { formatDate, initialsOf, letterGrade, relativeTime } from "@/lib/utils";
import type { Assignment, Course } from "@/lib/types";

interface GradeCell {
  id: string; // `${studentId}__${assignmentId}`
  score: number;
}

/**
 * Canvas-style weighted total, implemented once for the student pill,
 * instructor totals, and CSV so on-screen and exported figures always agree.
 *
 * `earnedOf` returns a graded item's earned score, or null/undefined when the
 * item isn't graded. Groups with weight > 0 and ≥1 graded item participate; a
 * group's percent renormalizes against the sum of participating weights, so an
 * ungraded group is excluded rather than counted as zero. Ungrouped graded
 * work (no group, or a group deleted out from under it) forms an implicit
 * bucket weighted by whatever the defined weights leave under 100. With no
 * weighted groups (or an offline fetch) this is plain points math.
 */
function computeTotal(
  assignments: Assignment[],
  earnedOf: (a: Assignment) => number | null | undefined,
  groups: AssignmentGroup[] | null,
): number | null {
  const graded = assignments.filter((a) => earnedOf(a) != null);
  const hasWeighted = groups != null && groups.some((g) => g.weight > 0);
  if (!hasWeighted) {
    const earned = graded.reduce((n, a) => n + (earnedOf(a) ?? 0), 0);
    const possible = graded.reduce((n, a) => n + a.points, 0);
    return possible ? Math.round((earned / possible) * 100) : null;
  }

  const byId = new Map(groups!.map((g) => [g.id, g]));
  const bucketPct = (items: Assignment[]): number | null => {
    const possible = items.reduce((n, a) => n + a.points, 0);
    if (!possible) return null;
    const earned = items.reduce((n, a) => n + (earnedOf(a) ?? 0), 0);
    return earned / possible;
  };

  let weightedSum = 0;
  let weightTotal = 0;
  for (const g of groups!) {
    if (g.weight <= 0) continue;
    const pct = bucketPct(graded.filter((a) => a.groupId === g.id));
    if (pct == null) continue;
    weightedSum += g.weight * pct;
    weightTotal += g.weight;
  }

  const definedWeight = groups!.reduce((n, g) => n + g.weight, 0);
  const implicitWeight = Math.max(0, 100 - definedWeight);
  if (implicitWeight > 0) {
    const pct = bucketPct(
      graded.filter((a) => !a.groupId || !byId.has(a.groupId)),
    );
    if (pct != null) {
      weightedSum += implicitWeight * pct;
      weightTotal += implicitWeight;
    }
  }

  if (weightTotal === 0) return null;
  return Math.round((weightedSum / weightTotal) * 100);
}

/** "Weighted: Homework 40% · Exams 60%" — or null when no weighted groups. */
function weightScheme(groups: AssignmentGroup[] | null): string | null {
  const active = (groups ?? []).filter((g) => g.weight > 0);
  if (active.length === 0) return null;
  return (
    "Weighted: " + active.map((g) => `${g.name} ${g.weight}%`).join(" · ")
  );
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

  // Weighted grading buckets, fetched once here and passed to both views.
  // Null = offline/none → plain points math downstream.
  const [groups, setGroups] = useState<AssignmentGroup[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchAssignmentGroups(course.id).then((g) => alive && setGroups(g));
    return () => {
      alive = false;
    };
  }, [course.id]);

  if (!teaching) {
    return (
      <StudentGrades course={course} assignments={assignments} groups={groups} />
    );
  }
  return (
    <InstructorGradebook
      course={course}
      assignments={assignments}
      groups={groups}
    />
  );
}

/* ----------------------------- Student view ----------------------------- */

function StudentGrades({
  course,
  assignments,
  groups,
}: {
  course: Course;
  assignments: Assignment[];
  groups: AssignmentGroup[] | null;
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

  // Rubric criteria per assignment + this student's own awarded scores (RLS
  // returns only their rows). Real assignments only; seed ids won't match.
  const [rubrics, setRubrics] = useState<Record<string, RubricCriterion[]>>({});
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    fetchRubrics(assignments.map((a) => a.id)).then(async (crit) => {
      if (!alive || !crit || crit.length === 0) return;
      const byAssignment: Record<string, RubricCriterion[]> = {};
      for (const c of crit) (byAssignment[c.assignmentId] ??= []).push(c);
      setRubrics(byAssignment);
      const scores = await fetchRubricScores(crit.map((c) => c.id));
      if (!alive || !scores) return;
      setRubricScores(
        Object.fromEntries(scores.map((s) => [s.criterionId, s.points])),
      );
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

  // A graded item's earned score (null otherwise) drives the weighted total.
  const earnedOf = (a: Assignment) => {
    const e = effective(a);
    return e.status === "graded" && e.score != null ? e.score : null;
  };
  const graded = assignments.filter((a) => earnedOf(a) != null);
  const earned = graded.reduce((n, a) => n + (earnedOf(a) ?? 0), 0);
  const possible = graded.reduce((n, a) => n + a.points, 0);
  const pct = computeTotal(assignments, earnedOf, groups) ?? 0;
  const scheme = weightScheme(groups);

  return (
    <>
      <PageHeader
        title="Grades"
        subtitle={`Based on ${graded.length} graded items in ${course.code}.`}
        action={
          <div className="text-right">
            <div
              className="rounded-xl px-4 py-2 text-white shadow-card"
              style={{ backgroundColor: course.color }}
            >
              <p className="text-2xl font-bold leading-none">
                {pct}% · {letterGrade(pct)}
              </p>
              <p className="text-xs text-white/85">
                {earned}/{possible} points
              </p>
            </div>
            {scheme && (
              <p className="mt-1 text-xs text-ink-faint">{scheme}</p>
            )}
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
              const feedback = mySubs[a.id]?.feedback;
              const criteria = rubrics[a.id] ?? [];
              const hasBreakdown = criteria.some(
                (c) => rubricScores[c.id] != null,
              );
              return (
                <tr key={a.id} className="hover:bg-surface-subtle">
                  <td className="px-4 py-3 align-top font-medium text-ink">
                    {a.title}
                    {feedback && (
                      <p className="mt-1 whitespace-pre-wrap text-xs font-normal text-ink-muted">
                        <span className="font-semibold text-ink-faint">
                          Instructor feedback:
                        </span>{" "}
                        {feedback}
                      </p>
                    )}
                    {hasBreakdown && (
                      <div className="mt-1 space-y-0.5 pl-3 text-xs font-normal text-ink-muted">
                        {criteria.map((c) => (
                          <p key={c.id} className="flex justify-between gap-3">
                            <span>{c.description}</span>
                            <span className="whitespace-nowrap text-ink-faint">
                              {rubricScores[c.id] ?? 0}/{c.points}
                            </span>
                          </p>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-ink-muted">
                    {formatDate(a.dueAt)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {e.status === "graded" ? (
                      <Badge tone="success">Graded</Badge>
                    ) : e.status === "late" ? (
                      <Badge tone="warning">Late</Badge>
                    ) : e.status === "missing" ? (
                      <Badge tone="danger">Missing</Badge>
                    ) : (
                      <Badge tone="neutral">Pending</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right align-top font-medium text-ink">
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
  groups,
}: {
  course: Course;
  assignments: Assignment[];
  groups: AssignmentGroup[] | null;
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

  const [realSubs, setRealSubs] = useState<Record<string, RemoteSubmission>>(
    {},
  );
  useEffect(() => {
    if (!realMode) return;
    let alive = true;
    fetchCourseSubmissions(assignments.map((a) => a.id)).then((subs) => {
      if (!alive || !subs) return;
      setRealSubs(
        Object.fromEntries(
          subs.map((s) => [cellId(s.userId, s.assignmentId), s]),
        ),
      );
    });
    return () => {
      alive = false;
    };
  }, [realMode, assignments]);

  // Rubric criteria per assignment + every student's awarded scores (RLS gives
  // the teaching account the whole roster). Real-mode only; keyed for O(1) reads.
  const [rubrics, setRubrics] = useState<Record<string, RubricCriterion[]>>({});
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});
  const [pubNote, setPubNote] = useState<string | null>(null);
  const scoreKey = (cid: string, sid: string) => `${cid}__${sid}`;
  useEffect(() => {
    if (!realMode) return;
    let alive = true;
    fetchRubrics(assignments.map((a) => a.id)).then(async (crit) => {
      if (!alive || !crit || crit.length === 0) return;
      const byAssignment: Record<string, RubricCriterion[]> = {};
      for (const c of crit) (byAssignment[c.assignmentId] ??= []).push(c);
      setRubrics(byAssignment);
      const scores = await fetchRubricScores(crit.map((c) => c.id));
      if (!alive || !scores) return;
      setRubricScores(
        Object.fromEntries(
          scores.map((s) => [scoreKey(s.criterionId, s.studentId), s.points]),
        ),
      );
    });
    return () => {
      alive = false;
    };
  }, [realMode, assignments]);

  // Award one criterion for the reviewed student; optimistic, note on refusal.
  async function setCriterionScore(
    criterion: RubricCriterion,
    sid: string,
    raw: string,
  ) {
    const points = Math.max(0, Math.min(criterion.points, Number(raw) || 0));
    setRubricScores((prev) => ({
      ...prev,
      [scoreKey(criterion.id, sid)]: points,
    }));
    if (!(await upsertRubricScore(criterion.id, sid, points))) {
      setPubNote("Couldn't save the rubric score (teaching account required).");
    }
  }

  function placeholderSub(
    sid: string,
    aid: string,
    score: number | null,
    feedback: string | undefined,
  ): RemoteSubmission {
    return {
      assignmentId: aid,
      userId: sid,
      status: score != null ? "graded" : "missing",
      score,
      body: "",
      feedback,
    };
  }

  const getScore = (sid: string, aid: string): number | undefined =>
    realMode
      ? realSubs[cellId(sid, aid)]?.score ?? undefined
      : grades.items.find((g) => g.id === cellId(sid, aid))?.score;

  async function setScore(sid: string, aid: string, raw: string, points: number) {
    if (realMode) {
      const score = raw === "" ? null : Math.max(0, Math.min(points, Number(raw)));
      if (score !== null && Number.isNaN(score)) return;
      const id = cellId(sid, aid);
      const existing = realSubs[id];
      setRealSubs((prev) => ({
        ...prev,
        [id]: existing
          ? { ...existing, score, status: score != null ? "graded" : existing.status }
          : placeholderSub(sid, aid, score, undefined),
      }));
      await upsertGrade(aid, sid, { score, feedback: existing?.feedback });
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

  const [reviewCell, setReviewCell] = useState<{ sid: string; aid: string } | null>(
    null,
  );
  const [reviewScore, setReviewScore] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState("");

  /** Fetch a short-lived signed URL for a submission attachment and open it. */
  async function openAttachment(path: string) {
    const url = await getSubmissionFileUrl(path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  function openReview(sid: string, aid: string) {
    const sub = realSubs[cellId(sid, aid)];
    setReviewCell({ sid, aid });
    setReviewScore(sub?.score != null ? String(sub.score) : "");
    setReviewFeedback(sub?.feedback ?? "");
  }

  const reviewAssignment = reviewCell
    ? assignments.find((a) => a.id === reviewCell.aid)
    : undefined;
  const reviewStudent = reviewCell
    ? activeRoster.find((s) => s.id === reviewCell.sid)
    : undefined;
  const reviewSub = reviewCell ? realSubs[cellId(reviewCell.sid, reviewCell.aid)] : undefined;
  const reviewCriteria = reviewCell ? rubrics[reviewCell.aid] ?? [] : [];
  const reviewRubricEarned = reviewCell
    ? reviewCriteria.reduce(
        (n, c) => n + (rubricScores[scoreKey(c.id, reviewCell.sid)] ?? 0),
        0,
      )
    : 0;
  const reviewRubricPossible = reviewCriteria.reduce((n, c) => n + c.points, 0);

  async function saveReview() {
    if (!reviewCell) return;
    const { sid, aid } = reviewCell;
    const points = reviewAssignment?.points ?? Infinity;
    const score =
      reviewScore === "" ? null : Math.max(0, Math.min(points, Number(reviewScore)));
    if (score !== null && Number.isNaN(score)) return;
    const feedback = reviewFeedback.trim();
    const id = cellId(sid, aid);
    setRealSubs((prev) => {
      const existing = prev[id];
      return {
        ...prev,
        [id]: existing
          ? { ...existing, score, feedback: feedback || undefined }
          : placeholderSub(sid, aid, score, feedback || undefined),
      };
    });
    await upsertGrade(aid, sid, { score, feedback });
    setReviewCell(null);
  }

  // Weighted (or plain, when no groups) total for one student — shared by the
  // on-screen total column and the CSV export so they never diverge.
  function studentPct(sid: string) {
    return computeTotal(assignments, (a) => getScore(sid, a.id), groups);
  }

  const scheme = weightScheme(groups);

  function assignmentAvg(aid: string, points: number) {
    const scores = activeRoster
      .map((s) => getScore(s.id, aid))
      .filter((v): v is number => v != null);
    if (scores.length === 0) return null;
    const avg = scores.reduce((n, v) => n + v, 0) / scores.length;
    return Math.round((avg / points) * 100);
  }

  /** Build a CSV of the current gradebook and trigger a browser download. */
  function exportCsv() {
    if (!realRoster) return;
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      "Student",
      "Email",
      ...assignments.map((a) => `${a.title} (/${a.points})`),
      "Total %",
      "Letter",
    ];
    const rows = realRoster.map((s) => {
      const pct = studentPct(s.id);
      return [
        s.name,
        s.email,
        ...assignments.map((a) => getScore(s.id, a.id) ?? ""),
        pct ?? "",
        pct != null ? letterGrade(pct) : "",
      ];
    });
    const csv = [header, ...rows]
      .map((row) => row.map(esc).join(","))
      .join("\r\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${course.code}-grades.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Gradebook"
        subtitle={`${activeRoster.length} students · ${assignments.length} assignments in ${course.code}. Enter scores — they save automatically.`}
        action={
          realMode ? (
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          ) : undefined
        }
      />

      {scheme && <p className="mb-4 text-xs text-ink-faint">{scheme}</p>}

      {pubNote && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {pubNote}
        </p>
      )}

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
                  {assignments.map((a) => {
                    const isLate =
                      realMode && realSubs[cellId(s.id, a.id)]?.status === "late";
                    return (
                      <td key={a.id} className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <div className="relative">
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
                            {isLate && (
                              <span
                                className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-surface bg-amber-500"
                                title="Submitted late"
                              />
                            )}
                          </div>
                          {realMode && (
                            <button
                              type="button"
                              onClick={() => openReview(s.id, a.id)}
                              className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink"
                              aria-label={`Review ${s.name} — ${a.title}`}
                            >
                              <MessageSquareText className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
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

      <Modal
        open={reviewCell !== null}
        onClose={() => setReviewCell(null)}
        title={`${reviewStudent?.name ?? "Student"} · ${reviewAssignment?.title ?? ""}`}
        description={
          reviewSub?.submittedAt
            ? `Submitted ${relativeTime(reviewSub.submittedAt)}${
                reviewSub.status === "late" ? " · Late" : ""
              }`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewCell(null)}>
              Cancel
            </Button>
            <Button onClick={saveReview}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          {reviewSub?.body ? (
            <div className="rounded-lg border border-black/10 bg-surface-subtle p-3 text-sm text-ink">
              <p className="whitespace-pre-wrap">{reviewSub.body}</p>
              {reviewSub.fileName && (
                <p className="mt-2 flex items-center gap-1 text-xs text-ink-faint">
                  <Paperclip className="h-3 w-3" />
                  {reviewSub.filePath ? (
                    <button
                      type="button"
                      onClick={() => openAttachment(reviewSub.filePath!)}
                      className="focus-ring underline underline-offset-2 hover:text-ink"
                    >
                      {reviewSub.fileName}
                    </button>
                  ) : (
                    reviewSub.fileName
                  )}
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-black/15 p-3 text-sm text-ink-faint">
              (No submission yet)
            </p>
          )}
          {reviewCriteria.length > 0 && reviewCell && (
            <div className="space-y-2 rounded-lg border border-black/10 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  Rubric
                </span>
                <span className="text-xs text-ink-faint">
                  Total: {reviewRubricEarned}/{reviewRubricPossible}
                </span>
              </div>
              {reviewCriteria.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm text-ink">
                    {c.description}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={c.points}
                    value={rubricScores[scoreKey(c.id, reviewCell.sid)] ?? ""}
                    onChange={(e) =>
                      setCriterionScore(c, reviewCell.sid, e.target.value)
                    }
                    placeholder="—"
                    className="focus-ring h-9 w-16 rounded-lg border border-black/10 bg-surface px-2 text-center text-sm text-ink placeholder:text-ink-faint"
                    aria-label={`${c.description} — points`}
                  />
                  <span className="whitespace-nowrap text-xs text-ink-faint">
                    /{c.points}
                  </span>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReviewScore(String(reviewRubricEarned))}
              >
                Use as score
              </Button>
            </div>
          )}
          <Field label={`Score (out of ${reviewAssignment?.points ?? 0})`}>
            <Input
              type="number"
              min={0}
              max={reviewAssignment?.points}
              value={reviewScore}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setReviewScore("");
                  return;
                }
                const points = reviewAssignment?.points ?? Infinity;
                const capped = Math.max(0, Math.min(points, Number(raw)));
                setReviewScore(Number.isNaN(capped) ? raw : String(capped));
              }}
              placeholder="—"
            />
          </Field>
          <Field label="Feedback">
            <Textarea
              value={reviewFeedback}
              onChange={(e) => setReviewFeedback(e.target.value)}
              placeholder="Leave feedback for the student…"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
