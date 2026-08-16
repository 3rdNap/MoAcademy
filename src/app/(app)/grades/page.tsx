import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import {
  getAssignments,
  getAuthState,
  getChildCourses,
  getCourses,
  getGuardianChildren,
  getWorkFor,
} from "@/lib/data";
import { ChildGrades, type ChildGradesView } from "@/components/family/ChildGrades";
import { letterGrade } from "@/lib/utils";

export const metadata = { title: "Grades" };

export default async function GradesPage() {
  const auth = await getAuthState();

  // Guardians see their children's standing, computed from marked submissions
  // rather than from their own (empty) enrolment.
  if (auth.authed && auth.role === "parent") {
    const children = await getGuardianChildren();
    const views: ChildGradesView[] = await Promise.all(
      children.map(async (child) => {
        const childCourses = await getChildCourses(child.id);
        const work = await getWorkFor(child.id, childCourses);
        const subjects = childCourses.map((course) => {
          const marked = work.filter(
            (w) => w.assignment.courseId === course.id && w.score != null,
          );
          const earned = marked.reduce((n, w) => n + (w.score ?? 0), 0);
          const possible = marked.reduce((n, w) => n + w.assignment.points, 0);
          return {
            courseId: course.id,
            name: course.name,
            code: course.code,
            color: course.color,
            pct: possible ? Math.round((earned / possible) * 100) : null,
            marked: marked.length,
          };
        });
        const scored = subjects.filter((s) => s.pct != null);
        return {
          child,
          subjects,
          overall: scored.length
            ? Math.round(
                scored.reduce((n, s) => n + (s.pct ?? 0), 0) / scored.length,
              )
            : null,
        };
      }),
    );
    return <ChildGrades views={views} />;
  }

  const courses = await getCourses();

  // A signed-in student's standing comes from their own marked submissions —
  // the same rows the instructor's gradebook writes and their guardian reads,
  // so all three see one number. The anonymous demo has no submissions, so it
  // falls back to the seed assignments' own graded status.
  const myWork =
    auth.authed && auth.userId ? await getWorkFor(auth.userId, courses) : null;

  const rows = await Promise.all(
    courses.map(async (course) => {
      if (myWork) {
        const marked = myWork.filter(
          (w) => w.assignment.courseId === course.id && w.score != null,
        );
        const earned = marked.reduce((n, w) => n + (w.score ?? 0), 0);
        const possible = marked.reduce((n, w) => n + w.assignment.points, 0);
        return {
          course,
          graded: marked.length,
          pct: possible ? Math.round((earned / possible) * 100) : null,
        };
      }
      const assignments = await getAssignments(course.id);
      const graded = assignments.filter(
        (a) => a.status === "graded" && a.score != null,
      );
      const earned = graded.reduce((n, a) => n + (a.score ?? 0), 0);
      const possible = graded.reduce((n, a) => n + a.points, 0);
      const pct = possible ? Math.round((earned / possible) * 100) : null;
      return { course, graded: graded.length, pct };
    }),
  );

  const overall =
    rows.filter((r) => r.pct != null).reduce((n, r) => n + (r.pct ?? 0), 0) /
    Math.max(1, rows.filter((r) => r.pct != null).length);

  return (
    <>
      <PageHeader
        title="Grades"
        subtitle="Your standing across every course this term."
        action={
          <div className="rounded-xl bg-brand-600 px-4 py-2 text-right text-white shadow-card">
            <p className="text-2xl font-bold leading-none">
              {Math.round(overall)}% · {letterGrade(overall)}
            </p>
            <p className="text-xs text-white/85">Term GPA estimate</p>
          </div>
        }
      />

      <div className="card divide-y divide-black/5">
        {rows.map(({ course, graded, pct }) => (
          <Link
            key={course.id}
            href={`/courses/${course.id}/grades`}
            className="flex items-center gap-4 p-4 hover:bg-surface-subtle"
          >
            <span
              className="h-10 w-1.5 rounded-full"
              style={{ backgroundColor: course.color }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-ink">{course.name}</p>
                <span className="text-xs text-ink-faint">{course.code}</span>
              </div>
              <div className="mt-2 max-w-md">
                <ProgressBar value={pct ?? 0} color={course.color} />
              </div>
              <p className="mt-1 text-xs text-ink-faint">
                {graded} graded {graded === 1 ? "item" : "items"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {pct != null ? (
                <>
                  <p className="text-xl font-bold text-ink">{pct}%</p>
                  <Badge tone="success">{letterGrade(pct)}</Badge>
                </>
              ) : (
                <Badge tone="neutral">No grades</Badge>
              )}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
