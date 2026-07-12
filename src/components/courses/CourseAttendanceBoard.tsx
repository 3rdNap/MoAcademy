"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/form";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { fetchCourseRoster, type RosterStudent } from "@/lib/gradebook-db";
import {
  clearAttendance,
  fetchCourseAttendance,
  setAttendance,
  type AttendanceRecord,
  type AttendanceStatus,
} from "@/lib/attendance-db";
import { formatDate, initialsOf } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Course } from "@/lib/types";

const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

const STATUS_BADGE: Record<AttendanceStatus, "success" | "danger" | "warning" | "info"> = {
  present: "success",
  absent: "danger",
  late: "warning",
  excused: "info",
};

// Selected-state colours for the instructor toggle buttons.
const STATUS_SELECTED: Record<AttendanceStatus, string> = {
  present: "border-emerald-500 bg-emerald-500 text-white",
  absent: "border-rose-500 bg-rose-500 text-white",
  late: "border-amber-500 bg-amber-500 text-white",
  excused: "border-sky-500 bg-sky-500 text-white",
};

/** Today's date as a local YYYY-MM-DD string (matches the <input type=date>). */
function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const cellKey = (studentId: string, onDate: string) => `${studentId}__${onDate}`;

export function CourseAttendanceBoard({ course }: { course: Course }) {
  const { role, hydrated } = useRole();
  const teaching = hydrated && canTeach(role);

  if (!teaching) return <StudentAttendance course={course} />;
  return <InstructorAttendance course={course} />;
}

/* --------------------------- Instructor view ---------------------------- */

function InstructorAttendance({ course }: { course: Course }) {
  const [roster, setRoster] = useState<RosterStudent[] | null | undefined>(
    undefined,
  );
  useEffect(() => {
    let alive = true;
    fetchCourseRoster(course.id).then((r) => alive && setRoster(r));
    return () => {
      alive = false;
    };
  }, [course.id]);

  // Records keyed by `${studentId}__${onDate}` for O(1) lookup/optimistic edits.
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  useEffect(() => {
    let alive = true;
    fetchCourseAttendance(course.id).then((rows) => {
      if (!alive || !rows) return;
      setRecords(
        Object.fromEntries(rows.map((r) => [cellKey(r.studentId, r.onDate), r])),
      );
    });
    return () => {
      alive = false;
    };
  }, [course.id]);

  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState<string | null>(null);

  // Real mode requires a signed-in teaching account for this subject.
  if (roster === undefined) {
    return (
      <>
        <PageHeader title="Attendance" subtitle={`Register for ${course.code}.`} />
        <div className="card p-6 text-sm text-ink-muted">Loading register…</div>
      </>
    );
  }
  if (roster === null) {
    return (
      <>
        <PageHeader title="Attendance" subtitle={`Register for ${course.code}.`} />
        <div className="card flex flex-col items-start gap-2 p-6">
          <p className="font-semibold text-ink">Sign in to take attendance</p>
          <p className="text-sm text-ink-muted">
            Attendance needs a signed-in teaching account for this subject. Once
            you&apos;re signed in as this course&apos;s instructor, your enrolled
            roster appears here.
          </p>
        </div>
      </>
    );
  }

  const statusOf = (sid: string): AttendanceStatus | undefined =>
    records[cellKey(sid, date)]?.status;

  async function toggle(sid: string, status: AttendanceStatus) {
    const key = cellKey(sid, date);
    const previous = records[key];
    const clearing = previous?.status === status;

    // Optimistic update, reverted on failure.
    setNote(null);
    setRecords((prev) => {
      const next = { ...prev };
      if (clearing) delete next[key];
      else
        next[key] = {
          id: previous?.id ?? key,
          courseKey: course.id,
          studentId: sid,
          onDate: date,
          status,
        };
      return next;
    });

    const ok = clearing
      ? await clearAttendance(course.id, sid, date)
      : await setAttendance(course.id, sid, date, status);
    if (!ok) {
      setRecords((prev) => {
        const next = { ...prev };
        if (previous) next[key] = previous;
        else delete next[key];
        return next;
      });
      setNote("Couldn't save attendance — a teaching account is required.");
    }
  }

  async function markAllPresent() {
    setNote(null);
    const targets = roster!.filter((s) => statusOf(s.id) !== "present");
    // Optimistic: flip everyone to present up front.
    setRecords((prev) => {
      const next = { ...prev };
      for (const s of targets) {
        const key = cellKey(s.id, date);
        next[key] = {
          id: next[key]?.id ?? key,
          courseKey: course.id,
          studentId: s.id,
          onDate: date,
          status: "present",
        };
      }
      return next;
    });
    const results = await Promise.all(
      targets.map((s) => setAttendance(course.id, s.id, date, "present")),
    );
    if (results.some((ok) => !ok)) {
      setNote("Couldn't save some marks — a teaching account is required.");
    }
  }

  // Summary for the picked date.
  const dayCounts = STATUSES.reduce(
    (acc, st) => {
      acc[st] = roster.filter((s) => statusOf(s.id) === st).length;
      return acc;
    },
    {} as Record<AttendanceStatus, number>,
  );
  const daySummary = STATUSES.filter((st) => dayCounts[st] > 0)
    .map((st) => `${dayCounts[st]} ${st}`)
    .join(" · ");

  // Per-student term rate: present+late over all days that student has a mark.
  function studentRate(sid: string): number | null {
    const marks = Object.values(records).filter((r) => r.studentId === sid);
    if (marks.length === 0) return null;
    const attended = marks.filter(
      (r) => r.status === "present" || r.status === "late",
    ).length;
    return Math.round((attended / marks.length) * 100);
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`${roster.length} students in ${course.code}. Term rate counts present + late over each student's marked days.`}
        action={
          <Button variant="outline" onClick={markAllPresent}>
            Mark all present
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Field label="Date" className="w-44">
          <Input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value || todayIso())}
          />
        </Field>
        <p className="text-sm text-ink-muted">
          {formatDate(date)} — {daySummary || "no marks yet"}
        </p>
      </div>

      {note && (
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
          {roster.map((s) => {
            const active = statusOf(s.id);
            const rate = studentRate(s.id);
            return (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 p-4"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <Avatar
                    initials={initialsOf(s.name)}
                    color={s.avatarColor}
                    size={28}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {s.name}
                    </span>
                    {rate != null && (
                      <span className="block text-xs text-ink-faint">
                        {rate}% term rate
                      </span>
                    )}
                  </span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((st) => {
                    const selected = active === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => toggle(s.id, st)}
                        aria-pressed={selected}
                        className={cn(
                          "focus-ring rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                          selected
                            ? STATUS_SELECTED[st]
                            : "border-black/10 text-ink-muted hover:bg-surface-subtle dark:border-white/10",
                        )}
                      >
                        {STATUS_LABEL[st]}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs text-ink-faint">
        Click a marked status again to unmark it. Marks save automatically to
        each student&apos;s record.
      </p>
    </>
  );
}

/* ----------------------------- Student view ----------------------------- */

function StudentAttendance({ course }: { course: Course }) {
  const [records, setRecords] = useState<AttendanceRecord[] | null | undefined>(
    undefined,
  );
  useEffect(() => {
    let alive = true;
    fetchCourseAttendance(course.id).then((r) => alive && setRecords(r));
    return () => {
      alive = false;
    };
  }, [course.id]);

  const counts = useMemo(() => {
    const base = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const r of records ?? []) base[r.status] += 1;
    return base;
  }, [records]);

  const total = counts.present + counts.absent + counts.late + counts.excused;
  const rate = total
    ? Math.round(((counts.present + counts.late) / total) * 100)
    : null;

  // Signed-out / anonymous / no rows: there is no local demo for attendance.
  if (records === undefined) {
    return (
      <>
        <PageHeader title="Attendance" subtitle={`Your record in ${course.code}.`} />
        <div className="card p-6 text-sm text-ink-muted">Loading…</div>
      </>
    );
  }
  if (records === null || total === 0) {
    return (
      <>
        <PageHeader title="Attendance" subtitle={`Your record in ${course.code}.`} />
        <div className="card flex flex-col items-start gap-2 p-6">
          <p className="font-semibold text-ink">No attendance recorded yet</p>
          <p className="text-sm text-ink-muted">
            Attendance is recorded by your instructor. When they mark a class,
            your record for {course.code} will appear here.
          </p>
        </div>
      </>
    );
  }

  const recent = [...records].sort((a, b) => b.onDate.localeCompare(a.onDate));

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`Your record in ${course.code}. Rate counts present + late as attended.`}
        action={
          rate != null ? (
            <div
              className="rounded-xl px-4 py-2 text-white shadow-card"
              style={{ backgroundColor: course.color }}
            >
              <p className="text-2xl font-bold leading-none">{rate}%</p>
              <p className="text-xs text-white/85">attendance rate</p>
            </div>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Present" value={counts.present} tone="text-emerald-600" />
        <Tile label="Absent" value={counts.absent} tone="text-rose-600" />
        <Tile label="Late" value={counts.late} tone="text-amber-600" />
        <Tile label="Excused" value={counts.excused} tone="text-sky-600" />
      </div>

      <div className="card divide-y divide-black/5">
        {recent.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 p-4">
            <span className="text-sm font-medium text-ink">
              {formatDate(r.onDate)}
            </span>
            <Badge tone={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
          </div>
        ))}
      </div>
    </>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="card flex items-center gap-3 p-3">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-lg bg-surface-subtle text-lg font-bold ${tone}`}
      >
        {value}
      </span>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}
