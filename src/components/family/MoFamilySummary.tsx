"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Widget } from "@/components/ui/Widget";
import { Button } from "@/components/ui/Button";
import { MoMarkIcon } from "@/components/layout/MoMarkIcon";
import type { Assignment, Course } from "@/lib/types";
import type { ChildAttendance, ChildCourseGrade } from "@/lib/data";

/** "Fri 18 Jul" — compact enough for a details line, distinct from the app's
 *  longer formatDate (which includes the year). */
function shortDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function buildDetails(
  childName: string,
  courses: Course[],
  grades: ChildCourseGrade[],
  attendance: ChildAttendance,
  upcoming: Assignment[],
): string[] {
  const gradesByCourse = new Map(grades.map((g) => [g.courseId, g]));
  const lines: string[] = [];

  for (const course of courses) {
    const grade = gradesByCourse.get(course.id);
    if (!grade || grade.possible <= 0) continue;
    const pct = Math.round((grade.earned / grade.possible) * 100);
    lines.push(
      `${course.code} ${course.name}: ${pct}% (${grade.graded} graded items)`,
    );
  }
  if (lines.length === 0) lines.push("No graded work yet");

  const attDays =
    attendance.present + attendance.absent + attendance.late + attendance.excused;
  if (attDays > 0) {
    const attRate = Math.round(
      ((attendance.present + attendance.late) / attDays) * 100,
    );
    lines.push(
      `Attendance: ${attRate}% (${attendance.absent} absence${attendance.absent === 1 ? "" : "s"})`,
    );
  }

  for (const a of upcoming.slice(0, 3)) {
    const course = courses.find((c) => c.id === a.courseId);
    lines.push(
      `Due soon: ${a.title} (${course?.code ?? "—"}) on ${shortDueDate(a.dueAt)}`,
    );
  }

  return lines;
}

export function MoFamilySummary({
  childName,
  courses,
  grades,
  attendance,
  upcoming,
}: {
  childName: string;
  courses: Course[];
  grades: ChildCourseGrade[];
  attendance: ChildAttendance;
  upcoming: Assignment[];
}) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const firstName = childName.split(" ")[0] || childName;

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const details = buildDetails(
        childName,
        courses,
        grades,
        attendance,
        upcoming,
      );
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "family-summary",
          title: firstName,
          details,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { text?: string; error?: string }
        | null;
      if (!res.ok || !data?.text) {
        setError(data?.error ?? "Mo couldn't put that together right now.");
        return;
      }
      setText(data.text);
    } catch {
      setError("Mo couldn't put that together right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Widget
      title="Mo's summary"
      icon={<MoMarkIcon className="h-4 w-auto" />}
    >
      {text ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-ink">{text}</p>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <Button
            variant="outline"
            size="sm"
            onClick={generate}
            disabled={busy}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {busy ? "Regenerating…" : "Regenerate"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            Get a warm, plain-language digest of {firstName}&apos;s week.
          </p>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <Button size="sm" onClick={generate} disabled={busy}>
            <Sparkles className="h-3.5 w-3.5" />
            {busy ? "Generating…" : "Generate summary"}
          </Button>
        </div>
      )}
    </Widget>
  );
}
