import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/reports/PrintButton";
import { ReportCard } from "@/components/reports/ReportCard";
import {
  getAuthState,
  getCourses,
  getCurrentTerm,
  getCurrentUser,
  getMyAttendance,
  getMyAwards,
  getMyCourseGrades,
} from "@/lib/data";

export const metadata = { title: "Report card" };

/**
 * The signed-in student's own printable term report. Anonymous visitors get
 * a notice instead of demo data — a report card is personal, not something
 * the seeded demo should fake.
 */
export default async function ReportPage() {
  const auth = await getAuthState();

  if (!auth.authed) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
        <div className="card p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <FileText className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-xl font-bold text-ink">
            Sign in to view your term report
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Your report card is built from your real grades and attendance
            for the current term, so it&apos;s only available once
            you&apos;re signed in.
          </p>
          <Link
            href="/login"
            className="focus-ring mt-5 inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  const [user, courses, grades, attendance, awards, term] = await Promise.all([
    getCurrentUser(),
    getCourses(),
    getMyCourseGrades(),
    getMyAttendance(),
    getMyAwards(),
    getCurrentTerm(),
  ]);

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Report card"
          subtitle={`Your term report for ${term}.`}
          action={<PrintButton />}
        />
      </div>
      <ReportCard
        studentName={user.name}
        term={term}
        courses={courses}
        grades={grades}
        attendance={attendance}
        awards={awards}
        issuedAt={new Date().toISOString()}
      />
    </>
  );
}
