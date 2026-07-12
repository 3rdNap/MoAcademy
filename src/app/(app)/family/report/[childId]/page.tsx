import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/reports/PrintButton";
import { ReportCard } from "@/components/reports/ReportCard";
import {
  getChildAttendance,
  getChildCourses,
  getChildGrades,
  getCurrentTerm,
  getGuardianChildren,
} from "@/lib/data";

export const metadata = { title: "Report card" };

/**
 * A guardian's printable term report for one linked child. Authorization is
 * the guardian_links relationship (migration 0017): the child id must be
 * among this guardian's own children, mirrored by RLS on the underlying
 * grade/attendance/course queries.
 */
export default async function ChildReportPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const children = await getGuardianChildren();
  const child = children.find((c) => c.id === childId);
  if (!child) notFound();

  const [courses, grades, attendance, term] = await Promise.all([
    getChildCourses(child.id),
    getChildGrades(child.id),
    getChildAttendance(child.id),
    getCurrentTerm(),
  ]);

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Report card"
          subtitle={`${child.name}'s term report for ${term}.`}
          action={<PrintButton />}
        />
      </div>
      <ReportCard
        studentName={child.name}
        term={term}
        courses={courses}
        grades={grades}
        attendance={attendance}
        issuedAt={new Date().toISOString()}
      />
    </>
  );
}
