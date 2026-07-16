"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Layers,
  LineChart,
  Megaphone,
  PlusCircle,
  Users,
} from "lucide-react";
import type { Course } from "@/lib/types";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { fetchRemoteAssignments } from "@/lib/course-content-db";
import {
  fetchCourseRoster,
  fetchCourseSubmissions,
} from "@/lib/gradebook-db";
import { fetchCourseAttendance } from "@/lib/attendance-db";

// The course home is server-rendered with student framing (To-do, progress) for
// everyone, since role is only known client-side. This island layers a teaching
// overview on top for teaching accounts, mirroring the dashboard's split. It
// renders nothing until hydrated, nothing for non-teaching viewers, and nothing
// when the roster fetch fails (anonymous demo / not a real teaching account) —
// so students' page is untouched.

// Submissions turned in but not yet graded.
const AWAITING = new Set(["submitted", "late"]);

interface Overview {
  students: number;
  awaiting: number;
  attendanceToday: boolean;
}

/** Today's date as a local YYYY-MM-DD string (matches attendance on_date). */
function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// null result = not a real teaching account for this course (roster RLS-denied
// or signed out); the caller then renders nothing.
async function loadOverview(courseId: string): Promise<Overview | null> {
  const roster = await fetchCourseRoster(courseId);
  if (roster == null) return null;

  const [assignments, attendance] = await Promise.all([
    fetchRemoteAssignments(courseId),
    fetchCourseAttendance(courseId),
  ]);

  const ids = (assignments ?? []).map((a) => a.id);
  const submissions = ids.length ? (await fetchCourseSubmissions(ids)) ?? [] : [];
  const awaiting = submissions.filter((s) => AWAITING.has(s.status)).length;

  const today = todayIso();
  const attendanceToday = (attendance ?? []).some((r) => r.onDate === today);

  return { students: roster.length, awaiting, attendanceToday };
}

function Stat({
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
    <div className="flex items-center gap-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle ${tone}`}
      >
        {icon}
      </span>
      <div>
        <p className="text-lg font-bold leading-none text-ink">{value}</p>
        <p className="mt-1 text-xs text-ink-muted">{label}</p>
      </div>
    </div>
  );
}

export function TeachingCoursePanel({ course }: { course: Course }) {
  const { role, hydrated } = useRole();
  const teaching = hydrated && canTeach(role);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!teaching) return;
    let alive = true;
    loadOverview(course.id).then((r) => {
      if (!alive) return;
      setOverview(r);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [teaching, course.id]);

  // Nothing before hydration, for students, or when this isn't a real teaching
  // account for the course — the student page below is then unchanged.
  if (!teaching || !ready || !overview) return null;

  const links = [
    { href: `/courses/${course.id}/assignments`, label: "New assignment", icon: PlusCircle },
    { href: `/courses/${course.id}/announcements`, label: "Post announcement", icon: Megaphone },
    { href: `/courses/${course.id}/attendance`, label: "Take attendance", icon: ClipboardList },
    { href: `/courses/${course.id}/modules`, label: "Manage modules", icon: Layers },
    { href: `/courses/${course.id}/insights`, label: "Insights", icon: LineChart },
  ];

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
          Teaching overview
        </h2>
        <span className="text-xs text-ink-faint">{course.code}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat
          icon={<Users className="h-5 w-5" />}
          label="Enrolled students"
          value={String(overview.students)}
          tone="text-sky-600"
        />
        <Link
          href={`/courses/${course.id}/grades`}
          className="focus-ring -m-1 rounded-lg p-1 hover:bg-surface-subtle"
        >
          <Stat
            icon={<ClipboardCheck className="h-5 w-5" />}
            label="Awaiting grading"
            value={String(overview.awaiting)}
            tone={overview.awaiting > 0 ? "text-amber-600" : "text-emerald-600"}
          />
        </Link>
        <Stat
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Attendance today"
          value={overview.attendanceToday ? "Taken" : "Not yet"}
          tone={overview.attendanceToday ? "text-emerald-600" : "text-ink-faint"}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-black/5 pt-4 dark:border-white/10">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-black/10 bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-subtle dark:border-white/10"
            >
              <Icon className="h-4 w-4 text-brand-600" />
              {l.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
