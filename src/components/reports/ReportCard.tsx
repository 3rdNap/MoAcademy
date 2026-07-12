import type { Course } from "@/lib/types";
import type { ChildAttendance, ChildCourseGrade } from "@/lib/data";
import { formatDate, letterGrade } from "@/lib/utils";

/**
 * A printable term report — same rollup math as the family dashboard
 * (plain-points sums; weighted groups are only reflected inside the course
 * gradebook itself). Used both for a student's own report (`/report`) and a
 * guardian's view of a linked child (`/family/report/[childId]`). Kept free
 * of client hooks so it renders on the server; the page supplies a
 * `PrintButton` island alongside it.
 */
export function ReportCard({
  studentName,
  term,
  courses,
  grades,
  attendance,
  issuedAt,
}: {
  studentName: string;
  term: string;
  courses: Course[];
  grades: ChildCourseGrade[];
  attendance: ChildAttendance;
  issuedAt: string;
}) {
  const gradesByCourse = new Map(grades.map((g) => [g.courseId, g]));
  const rows = courses.map((course) => {
    const grade = gradesByCourse.get(course.id);
    const hasGrade = !!grade && grade.possible > 0;
    const pct = hasGrade ? Math.round((grade!.earned / grade!.possible) * 100) : null;
    return { course, grade: hasGrade ? grade! : null, pct };
  });
  const overall = rows.reduce(
    (acc, r) =>
      r.grade
        ? { earned: acc.earned + r.grade.earned, possible: acc.possible + r.grade.possible }
        : acc,
    { earned: 0, possible: 0 },
  );
  const overallPct = overall.possible
    ? Math.round((overall.earned / overall.possible) * 100)
    : null;

  const attDays =
    attendance.present + attendance.absent + attendance.late + attendance.excused;
  const attRate = attDays
    ? Math.round(((attendance.present + attendance.late) / attDays) * 100)
    : null;

  return (
    <div className="card mx-auto max-w-3xl p-8 print:m-0 print:max-w-none print:rounded-none print:border-black print:p-0 print:shadow-none">
      {/* Institution header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-6 print:border-black">
        <div>
          <p className="text-lg font-extrabold tracking-tight text-ink print:text-black">
            MoAcademy
          </p>
          <p className="mt-1 text-sm text-ink-muted print:text-black">
            Term report · {term}
          </p>
        </div>
        <p className="text-xs text-ink-faint print:text-black">
          Issued {formatDate(issuedAt)}
        </p>
      </div>

      {/* Student block */}
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint print:text-black">
          Student
        </p>
        <p className="mt-1 text-xl font-bold text-ink print:text-black">
          {studentName}
        </p>
      </div>

      {/* Courses table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase tracking-wide text-ink-faint print:border-black print:text-black">
              <th className="py-2 pr-3">Course</th>
              <th className="py-2 pr-3">Instructor</th>
              <th className="py-2 pr-3 text-right">Graded items</th>
              <th className="py-2 pr-3 text-right">Points</th>
              <th className="py-2 pr-3 text-right">Percent</th>
              <th className="py-2 text-right">Letter</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ course, grade, pct }) => (
              <tr
                key={course.id}
                className="border-b border-black/5 text-ink print:border-black/40 print:text-black"
              >
                <td className="py-2 pr-3">
                  <p className="font-medium">{course.name}</p>
                  <p className="text-xs text-ink-faint print:text-black">
                    {course.code}
                  </p>
                </td>
                <td className="py-2 pr-3">{course.instructor}</td>
                <td className="py-2 pr-3 text-right">{grade ? grade.graded : "—"}</td>
                <td className="py-2 pr-3 text-right">
                  {grade ? `${grade.earned}/${grade.possible}` : "—"}
                </td>
                <td className="py-2 pr-3 text-right">{pct != null ? `${pct}%` : "—"}</td>
                <td className="py-2 text-right font-semibold">
                  {pct != null ? letterGrade(pct) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-ink-faint print:text-black">
                  No enrolled courses this term.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-black/10 text-ink print:border-black print:text-black">
                <td className="py-2 pr-3 font-semibold" colSpan={2}>
                  Overall
                </td>
                <td className="py-2 pr-3 text-right font-semibold">
                  {rows.reduce((n, r) => n + (r.grade?.graded ?? 0), 0)}
                </td>
                <td className="py-2 pr-3 text-right font-semibold">
                  {overall.possible ? `${overall.earned}/${overall.possible}` : "—"}
                </td>
                <td className="py-2 pr-3 text-right font-semibold">
                  {overallPct != null ? `${overallPct}%` : "—"}
                </td>
                <td className="py-2 text-right font-semibold">
                  {overallPct != null ? letterGrade(overallPct) : "—"}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Attendance */}
      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint print:text-black">
          Attendance
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <AttendanceStat label="Present" value={attendance.present} />
          <AttendanceStat label="Absent" value={attendance.absent} />
          <AttendanceStat label="Late" value={attendance.late} />
          <AttendanceStat label="Excused" value={attendance.excused} />
          <AttendanceStat label="Rate" value={attRate != null ? `${attRate}%` : "—"} />
        </div>
      </div>

      {/* Footer note */}
      <p className="mt-8 border-t border-black/10 pt-4 text-xs text-ink-faint print:border-black print:text-black">
        Generated by MoAcademy · weighted-group grading, where configured by an
        instructor, is reflected in the course gradebook.
      </p>
    </div>
  );
}

function AttendanceStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-black/10 p-3 text-center print:border-black">
      <p className="text-lg font-bold text-ink print:text-black">{value}</p>
      <p className="text-xs text-ink-faint print:text-black">{label}</p>
    </div>
  );
}
