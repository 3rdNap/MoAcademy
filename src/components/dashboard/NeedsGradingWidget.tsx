"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ClipboardCheck, Users } from "lucide-react";
import type { Course } from "@/lib/types";
import { fetchRemoteAssignments } from "@/lib/course-content-db";
import {
  fetchCourseRoster,
  fetchCourseSubmissions,
} from "@/lib/gradebook-db";

// Client-side teaching insights for the instructor dashboard. Server data
// scopes to a student's own submissions, so the roster/submission counts a
// teacher needs (RLS-scoped to what they teach) have to be fetched here. Both
// the stat strip and the "Needs grading" list read from one shared load,
// memoized at module scope like src/lib/term.ts so mounting several consumers
// triggers a single fetch pass.

interface GradingRow {
  assignmentId: string;
  title: string;
  courseId: string;
  courseCode: string;
  toGrade: number;
}

interface InstructorLoad {
  rows: GradingRow[]; // per-assignment ungraded counts, highest first
  awaiting: number; // total submissions awaiting a grade
  students: number; // distinct enrolled students across all taught courses
}

// Submissions in these states are turned in but not yet graded.
const AWAITING = new Set(["submitted", "late"]);

async function loadForCourses(courses: Course[]): Promise<InstructorLoad> {
  const rows: GradingRow[] = [];
  const studentIds = new Set<string>();

  await Promise.all(
    courses.map(async (course) => {
      const [assignments, roster] = await Promise.all([
        fetchRemoteAssignments(course.id),
        fetchCourseRoster(course.id),
      ]);
      for (const s of roster ?? []) studentIds.add(s.id);

      const ids = (assignments ?? []).map((a) => a.id);
      if (ids.length === 0) return;
      const submissions = (await fetchCourseSubmissions(ids)) ?? [];

      const counts = new Map<string, number>();
      for (const sub of submissions) {
        if (!AWAITING.has(sub.status)) continue;
        counts.set(sub.assignmentId, (counts.get(sub.assignmentId) ?? 0) + 1);
      }
      for (const a of assignments ?? []) {
        const toGrade = counts.get(a.id) ?? 0;
        if (toGrade === 0) continue;
        rows.push({
          assignmentId: a.id,
          title: a.title,
          courseId: course.id,
          courseCode: course.code,
          toGrade,
        });
      }
    }),
  );

  rows.sort((a, b) => b.toGrade - a.toGrade);
  return {
    rows,
    awaiting: rows.reduce((n, r) => n + r.toGrade, 0),
    students: studentIds.size,
  };
}

// Module-scope memo: keyed by the set of course ids so remounting reuses the
// in-flight/last promise instead of re-querying Supabase per consumer.
let cachedKey = "";
let cachedLoad: Promise<InstructorLoad> | null = null;

function sharedLoad(courses: Course[]): Promise<InstructorLoad> {
  const key = courses
    .map((c) => c.id)
    .sort()
    .join(",");
  if (key !== cachedKey || !cachedLoad) {
    cachedKey = key;
    cachedLoad = loadForCourses(courses);
  }
  return cachedLoad;
}

function useInstructorLoad(courses: Course[]): InstructorLoad | null {
  const [load, setLoad] = useState<InstructorLoad | null>(null);
  const key = courses.map((c) => c.id).join(",");
  useEffect(() => {
    let alive = true;
    sharedLoad(courses).then((r) => {
      if (alive) setLoad(r);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return load;
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="card flex items-center gap-3 p-3">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-lg bg-surface-subtle ${tone}`}
      >
        {icon}
      </span>
      <div>
        <p className="text-xl font-bold leading-none text-ink">{value}</p>
        <p className="mt-1 text-xs text-ink-muted">{label}</p>
      </div>
    </div>
  );
}

/** The instructor stat strip: teaching courses (known) plus roster size and
 *  grading backlog (fetched). Shows a placeholder until the load resolves. */
export function InstructorStatStrip({ courses }: { courses: Course[] }) {
  const load = useInstructorLoad(courses);
  const dash = load ? undefined : "…";
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatCard
        icon={<BookOpen className="h-5 w-5" />}
        label="Teaching courses"
        value={String(courses.length)}
        tone="text-brand-600"
      />
      <StatCard
        icon={<Users className="h-5 w-5" />}
        label="Students"
        value={dash ?? String(load!.students)}
        tone="text-sky-600"
      />
      <StatCard
        icon={<ClipboardCheck className="h-5 w-5" />}
        label="Awaiting grading"
        value={dash ?? String(load!.awaiting)}
        tone={load && load.awaiting > 0 ? "text-amber-600" : "text-emerald-600"}
      />
    </div>
  );
}

/** The Canvas To-Do equivalent: assignments with work turned in but not yet
 *  graded, each linking straight into that course's gradebook. */
export function NeedsGradingWidget({ courses }: { courses: Course[] }) {
  const load = useInstructorLoad(courses);

  if (!load) {
    return (
      <p className="text-sm text-ink-muted">Checking for work to grade…</p>
    );
  }

  const rows = load.rows.slice(0, 8);
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-start gap-1">
        <p className="text-sm font-medium text-ink">All caught up</p>
        <p className="text-sm text-ink-muted">Nothing waiting on you.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.assignmentId}>
          <Link
            href={`/courses/${r.courseId}/grades`}
            className="focus-ring -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-subtle"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">
                {r.title}
              </span>
              <span className="block text-xs text-ink-faint">
                {r.courseCode}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              {r.toGrade} to grade
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
