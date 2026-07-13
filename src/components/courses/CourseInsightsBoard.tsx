"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Widget } from "@/components/ui/Widget";
import { Field, Textarea } from "@/components/ui/form";
import { MoMarkIcon } from "@/components/layout/MoMarkIcon";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchCourseRoster,
  fetchCourseSubmissions,
  fetchMySubmissions,
  type RemoteSubmission,
  type RosterStudent,
} from "@/lib/gradebook-db";
import {
  fetchCourseAttendance,
  type AttendanceRecord,
} from "@/lib/attendance-db";
import { fetchRemoteAssignments } from "@/lib/course-content-db";
import { sendRemoteMessage } from "@/lib/inbox-db";
import type { PlanDay } from "@/app/api/plan/route";
import { formatDate, initialsOf } from "@/lib/utils";
import type { Assignment, Course } from "@/lib/types";

/* ----------------------------- shared math ------------------------------ */

type RiskLevel = "none" | "track" | "watch" | "risk";

interface Metrics {
  gradePct: number | null;
  missing: number;
  late: number;
  attendanceRate: number | null;
  lastSubmission?: string;
  /** Missing/late assignments, for the student-facing detail list. */
  flaggedItems: { assignment: Assignment; kind: "missing" | "late" }[];
  flags: number;
  level: RiskLevel;
}

const isPublished = (a: Assignment, now: number) =>
  !a.availableAt || new Date(a.availableAt).getTime() <= now;
const isPastDue = (a: Assignment, now: number) =>
  new Date(a.dueAt).getTime() < now;

/**
 * Fuse a student's grades, submission timeliness and attendance into a single
 * transparent risk read. Flags = (average < 60) + (missing ≥ 2) +
 * (attendance < 75%) + (late ≥ 2). A rate only contributes a flag when there's
 * data for it, so a roster with no graded work / no marks reads "No data yet"
 * (level "none") rather than "at risk".
 */
function computeMetrics(
  assignments: Assignment[],
  subs: RemoteSubmission[],
  attendance: AttendanceRecord[],
  now: number,
): Metrics {
  const byAssignment = new Map(subs.map((s) => [s.assignmentId, s]));

  let earned = 0;
  let possible = 0;
  let missing = 0;
  let late = 0;
  const flaggedItems: Metrics["flaggedItems"] = [];

  for (const a of assignments) {
    const sub = byAssignment.get(a.id);
    if (sub?.status === "graded" && sub.score != null) {
      earned += sub.score;
      possible += a.points;
    }
    if (sub?.status === "late") {
      late += 1;
      flaggedItems.push({ assignment: a, kind: "late" });
    }
    if (
      isPublished(a, now) &&
      isPastDue(a, now) &&
      (!sub || sub.status === "missing")
    ) {
      missing += 1;
      flaggedItems.push({ assignment: a, kind: "missing" });
    }
  }

  const gradePct = possible > 0 ? Math.round((earned / possible) * 100) : null;

  const marked = attendance.length;
  const attended = attendance.filter(
    (r) => r.status === "present" || r.status === "late",
  ).length;
  const attendanceRate = marked > 0 ? Math.round((attended / marked) * 100) : null;

  const lastSubmission = subs
    .map((s) => s.submittedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  let flags = 0;
  if (gradePct != null && gradePct < 60) flags += 1;
  if (missing >= 2) flags += 1;
  if (attendanceRate != null && attendanceRate < 75) flags += 1;
  if (late >= 2) flags += 1;

  const noData =
    gradePct == null && attendanceRate == null && missing === 0 && late === 0;
  const level: RiskLevel = noData
    ? "none"
    : flags >= 2
      ? "risk"
      : flags === 1
        ? "watch"
        : "track";

  return {
    gradePct,
    missing,
    late,
    attendanceRate,
    lastSubmission,
    flaggedItems,
    flags,
    level,
  };
}

const LEVEL_LABEL: Record<RiskLevel, string> = {
  none: "No data yet",
  track: "On track",
  watch: "Watch",
  risk: "At risk",
};
const LEVEL_TONE: Record<RiskLevel, "neutral" | "success" | "warning" | "danger"> = {
  none: "neutral",
  track: "success",
  watch: "warning",
  risk: "danger",
};

/** Compact one-line context for Mo's check-in and the student banner. */
function contextString(m: Metrics, code: string): string {
  const parts: string[] = [];
  if (m.gradePct != null) parts.push(`average ${m.gradePct}% in ${code}`);
  if (m.missing > 0)
    parts.push(`${m.missing} missing assignment${m.missing === 1 ? "" : "s"}`);
  if (m.late > 0) parts.push(`${m.late} late submission${m.late === 1 ? "" : "s"}`);
  if (m.attendanceRate != null) parts.push(`attendance ${m.attendanceRate}%`);
  return parts.join(", ") || `just getting started in ${code}`;
}

/* ------------------------------- entry ---------------------------------- */

export function CourseInsightsBoard({
  course,
  senderName,
}: {
  course: Course;
  senderName: string;
}) {
  const { role, hydrated } = useRole();

  if (!hydrated) {
    return (
      <>
        <PageHeader title="Insights" subtitle={`Success signals for ${course.code}.`} />
        <div className="card p-6 text-sm text-ink-muted">Loading…</div>
      </>
    );
  }
  if (canTeach(role)) return <TeacherInsights course={course} senderName={senderName} />;
  return <StudentInsights course={course} />;
}

/* --------------------------- Instructor view ---------------------------- */

interface StudentRow extends RosterStudent {
  metrics: Metrics;
}

function TeacherInsights({
  course,
  senderName,
}: {
  course: Course;
  senderName: string;
}) {
  const [roster, setRoster] = useState<RosterStudent[] | null | undefined>(
    undefined,
  );
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subs, setSubs] = useState<RemoteSubmission[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetchCourseRoster(course.id);
      if (!alive) return;
      setRoster(r);
      if (!r) return; // offline / not a teaching account for this subject
      const as = (await fetchRemoteAssignments(course.id)) ?? [];
      const ids = as.map((a) => a.id);
      const [s, att] = await Promise.all([
        ids.length
          ? fetchCourseSubmissions(ids)
          : Promise.resolve<RemoteSubmission[] | null>([]),
        fetchCourseAttendance(course.id),
      ]);
      if (!alive) return;
      setAssignments(as);
      setSubs(s ?? []);
      setAttendance(att ?? []);
    })();
    return () => {
      alive = false;
    };
  }, [course.id]);

  const now = Date.now();
  const rows = useMemo<StudentRow[]>(() => {
    if (!roster) return [];
    const rank: Record<RiskLevel, number> = { risk: 0, watch: 1, track: 2, none: 3 };
    return roster
      .map((s) => ({
        ...s,
        metrics: computeMetrics(
          assignments,
          subs.filter((sub) => sub.userId === s.id),
          attendance.filter((a) => a.studentId === s.id),
          now,
        ),
      }))
      .sort((a, b) => rank[a.metrics.level] - rank[b.metrics.level]);
  }, [roster, assignments, subs, attendance, now]);

  const summary = useMemo(() => {
    const graded = rows.map((r) => r.metrics.gradePct).filter((p): p is number => p != null);
    const classAvg = graded.length
      ? Math.round(graded.reduce((n, p) => n + p, 0) / graded.length)
      : null;
    const atRisk = rows.filter((r) => r.metrics.level === "risk").length;
    const marked = attendance.length;
    const attended = attendance.filter(
      (a) => a.status === "present" || a.status === "late",
    ).length;
    const attRate = marked ? Math.round((attended / marked) * 100) : null;
    return { classAvg, atRisk, attRate };
  }, [rows, attendance]);

  // Draft-and-send flow state (one student at a time).
  const [active, setActive] = useState<StudentRow | null>(null);
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function openDraft(student: StudentRow) {
    setActive(student);
    setDraft("");
    setSent(false);
    setNote(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "student-checkin",
          title: student.name.split(/\s+/)[0] || student.name,
          course: course.code,
          context: contextString(student.metrics, course.code),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { text?: string; error?: string }
        | null;
      if (!res.ok || !data?.text) {
        setNote(data?.error ?? "Mo couldn't draft that just now.");
      } else {
        setDraft(data.text);
      }
    } catch {
      setNote("Mo couldn't draft that just now.");
    } finally {
      setGenerating(false);
    }
  }

  async function send() {
    if (!active || !draft.trim()) return;
    setSending(true);
    setNote(null);
    const ok = await sendRemoteMessage({
      recipientId: active.id,
      recipientName: active.name,
      subject: `Checking in — ${course.code}`,
      body: draft.trim(),
      senderName,
    });
    setSending(false);
    if (ok) setSent(true);
    else setNote("Couldn't send — you can only message your own students.");
  }

  if (roster === undefined) {
    return (
      <>
        <PageHeader title="Insights" subtitle={`Success signals for ${course.code}.`} />
        <div className="card p-6 text-sm text-ink-muted">Reading the class…</div>
      </>
    );
  }
  if (roster === null) {
    return (
      <>
        <PageHeader title="Insights" subtitle={`Success signals for ${course.code}.`} />
        <div className="card flex flex-col items-start gap-2 p-6">
          <p className="font-semibold text-ink">Sign in to see class insights</p>
          <p className="text-sm text-ink-muted">
            Insights read your enrolled roster&apos;s real grades, missing work
            and attendance. Sign in as this course&apos;s teaching account to see
            them.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Insights"
        subtitle={`Early-warning signals across ${roster.length} students in ${course.code}.`}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryTile
          label="Class average"
          value={summary.classAvg != null ? `${summary.classAvg}%` : "—"}
        />
        <SummaryTile
          label="At risk"
          value={String(summary.atRisk)}
          tone={summary.atRisk > 0 ? "text-rose-600" : "text-emerald-600"}
        />
        <SummaryTile
          label="Attendance rate"
          value={summary.attRate != null ? `${summary.attRate}%` : "—"}
        />
      </div>

      <p className="mb-3 text-xs text-ink-faint">
        Flags: average under 60%, 2+ missing, attendance under 75%, or 2+ late.
        One flag is a watch; two or more is at risk. Sorted most-urgent first.
      </p>

      {note && !active && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {note}
        </p>
      )}

      {roster.length === 0 ? (
        <div className="card p-6 text-sm text-ink-muted">
          No students are enrolled in {course.code} for the current term yet.
        </div>
      ) : (
        <div className="card divide-y divide-black/5">
          {rows.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 p-4">
              <Avatar initials={initialsOf(s.name)} color={s.avatarColor} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">
                    {s.name}
                  </span>
                  <Badge tone={LEVEL_TONE[s.metrics.level]}>
                    {LEVEL_LABEL[s.metrics.level]}
                  </Badge>
                </div>
                <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-muted">
                  <span>
                    Avg{" "}
                    {s.metrics.gradePct != null ? `${s.metrics.gradePct}%` : "—"}
                  </span>
                  <span>{s.metrics.missing} missing</span>
                  <span>{s.metrics.late} late</span>
                  <span>
                    Attendance{" "}
                    {s.metrics.attendanceRate != null
                      ? `${s.metrics.attendanceRate}%`
                      : "—"}
                  </span>
                  {s.metrics.lastSubmission && (
                    <span className="text-ink-faint">
                      Last turned in {formatDate(s.metrics.lastSubmission)}
                    </span>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openDraft(s)}
              >
                <MessageSquareText className="h-4 w-4" /> Draft check-in with Mo
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={active !== null}
        onClose={() => setActive(null)}
        title={active ? `Check in with ${active.name}` : "Check in"}
        description={active ? contextString(active.metrics, course.code) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setActive(null)}>
              {sent ? "Close" : "Cancel"}
            </Button>
            {!sent && (
              <Button onClick={send} disabled={generating || sending || !draft.trim()}>
                {sending ? "Sending…" : "Send message"}
              </Button>
            )}
          </>
        }
      >
        {sent ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            Sent — {active?.name} will see it in their Inbox.
          </p>
        ) : (
          <div className="space-y-3">
            <Field label="Message">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={generating ? "Mo is drafting…" : "Write your message…"}
                className="min-h-[140px]"
                disabled={generating}
              />
            </Field>
            {generating && (
              <p className="text-xs text-ink-faint">Mo is drafting a warm check-in…</p>
            )}
            {note && <p className="text-xs text-rose-600">{note}</p>}
            <p className="text-xs text-ink-faint">
              Mo drafts a starting point — edit freely before it sends through your
              real inbox.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

function SummaryTile({
  label,
  value,
  tone = "text-ink",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="card p-4">
      <p className={`text-2xl font-bold leading-none ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{label}</p>
    </div>
  );
}

/* ----------------------------- Student view ----------------------------- */

function StudentInsights({ course }: { course: Course }) {
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subs, setSubs] = useState<RemoteSubmission[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const user = supabase ? (await supabase.auth.getUser()).data.user : null;
      if (!alive) return;
      if (!user) {
        setSignedIn(false);
        return;
      }
      setSignedIn(true);
      const as = (await fetchRemoteAssignments(course.id)) ?? [];
      const ids = as.map((a) => a.id);
      const [s, att] = await Promise.all([
        ids.length
          ? fetchMySubmissions(ids)
          : Promise.resolve<RemoteSubmission[] | null>([]),
        fetchCourseAttendance(course.id),
      ]);
      if (!alive) return;
      setAssignments(as);
      setSubs(s ?? []);
      setAttendance(att ?? []);
    })();
    return () => {
      alive = false;
    };
  }, [course.id]);

  const now = Date.now();
  const metrics = useMemo(
    () => computeMetrics(assignments, subs, attendance, now),
    [assignments, subs, attendance, now],
  );

  // Study-plan state.
  const [plan, setPlan] = useState<PlanDay[] | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  async function askForPlan() {
    if (planning) return;
    setPlanning(true);
    setPlanError(null);
    try {
      const upcoming = assignments
        .filter((a) => new Date(a.dueAt).getTime() >= now)
        .slice(0, 10)
        .map((a) => ({
          title: a.title,
          course: course.code,
          dueAt: a.dueAt,
          points: a.points,
        }));
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadlines: upcoming, subjects: [course.name] }),
      });
      const data = (await res.json().catch(() => null)) as
        | { days?: PlanDay[]; error?: string }
        | null;
      if (!res.ok || !data?.days?.length) {
        setPlanError(data?.error ?? "Couldn't build a plan right now.");
        return;
      }
      setPlan(data.days);
    } catch {
      setPlanError("Couldn't build a plan right now.");
    } finally {
      setPlanning(false);
    }
  }

  if (signedIn === undefined) {
    return (
      <>
        <PageHeader title="Insights" subtitle={`Your standing in ${course.code}.`} />
        <div className="card p-6 text-sm text-ink-muted">Loading…</div>
      </>
    );
  }
  if (signedIn === false) {
    return (
      <>
        <PageHeader title="Insights" subtitle={`Your standing in ${course.code}.`} />
        <div className="card flex flex-col items-start gap-2 p-6">
          <p className="font-semibold text-ink">Sign in to see your insights</p>
          <p className="text-sm text-ink-muted">
            Insights turn your real grades, missing work and attendance into a
            personal read on how {course.code} is going. Sign in to see yours.
          </p>
        </div>
      </>
    );
  }

  const banner =
    metrics.level === "none"
      ? {
          tone: "neutral" as const,
          title: `Nothing to flag yet in ${course.code}`,
          detail: "Once grades and attendance start landing, your standing shows here.",
        }
      : metrics.flags === 0
        ? {
            tone: "success" as const,
            title: `You're on track in ${course.code}`,
            detail: "Grades, attendance and deadlines are all looking healthy.",
          }
        : {
            tone: metrics.level === "risk" ? ("danger" as const) : ("warning" as const),
            title: `${metrics.flags} thing${metrics.flags === 1 ? "" : "s"} need attention`,
            detail: contextString(metrics, course.code),
          };

  const BANNER_CLASS: Record<"neutral" | "success" | "warning" | "danger", string> = {
    neutral: "border-black/10 bg-surface-subtle dark:border-white/10",
    success:
      "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10",
    warning: "border-amber-500/30 bg-amber-50 dark:bg-amber-500/10",
    danger: "border-rose-500/30 bg-rose-50 dark:bg-rose-500/10",
  };

  return (
    <>
      <PageHeader title="Insights" subtitle={`Your standing in ${course.code}.`} />

      <div className={`card mb-6 border p-5 ${BANNER_CLASS[banner.tone]}`}>
        <div className="flex items-center gap-2">
          <Badge tone={LEVEL_TONE[metrics.level]}>{LEVEL_LABEL[metrics.level]}</Badge>
          <h2 className="text-base font-semibold text-ink">{banner.title}</h2>
        </div>
        <p className="mt-1 text-sm text-ink-muted">{banner.detail}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile
          label="Average"
          value={metrics.gradePct != null ? `${metrics.gradePct}%` : "—"}
        />
        <SummaryTile
          label="Missing"
          value={String(metrics.missing)}
          tone={metrics.missing > 0 ? "text-rose-600" : "text-ink"}
        />
        <SummaryTile
          label="Late"
          value={String(metrics.late)}
          tone={metrics.late > 0 ? "text-amber-600" : "text-ink"}
        />
        <SummaryTile
          label="Attendance"
          value={metrics.attendanceRate != null ? `${metrics.attendanceRate}%` : "—"}
        />
      </div>

      {metrics.flaggedItems.length > 0 && (
        <div className="card mb-6 divide-y divide-black/5">
          <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Needs attention
          </p>
          {metrics.flaggedItems.map(({ assignment, kind }) => (
            <div
              key={`${kind}-${assignment.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {assignment.title}
                </p>
                <p className="text-xs text-ink-muted">Due {formatDate(assignment.dueAt)}</p>
              </div>
              <Badge tone={kind === "missing" ? "danger" : "warning"}>
                {kind === "missing" ? "Missing" : "Late"}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <Widget
        title="Mo's study plan"
        icon={<MoMarkIcon className="h-4 w-auto" />}
        action={
          plan ? (
            <button
              onClick={askForPlan}
              disabled={planning}
              className="focus-ring text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
            >
              {planning ? "Planning…" : "Refresh"}
            </button>
          ) : undefined
        }
      >
        {!plan ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-sm text-ink-muted">
              Mo can turn your {course.code} deadlines into a focused 7-day plan.
            </p>
            <Button size="sm" onClick={askForPlan} disabled={planning}>
              {planning ? "Planning…" : "Ask Mo for a study plan"}
            </Button>
            {planError && <p className="text-xs text-rose-600">{planError}</p>}
          </div>
        ) : (
          <div>
            <ol className="space-y-3">
              {plan.map((d) => (
                <li key={d.day}>
                  <p className="text-sm font-semibold text-ink">
                    {d.day}{" "}
                    <span className="font-normal text-ink-faint">· {d.focus}</span>
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {d.tasks.map((t, i) => (
                      <li key={i} className="flex gap-2 text-sm text-ink-muted">
                        <span className="text-brand-400">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            {planError && <p className="mt-2 text-xs text-rose-600">{planError}</p>}
          </div>
        )}
      </Widget>
    </>
  );
}
