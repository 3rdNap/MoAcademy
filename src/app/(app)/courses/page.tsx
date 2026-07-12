import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { CourseCard } from "@/components/dashboard/CourseCard";
import { getAuthState, getCourses } from "@/lib/data";

export const metadata = { title: "Courses" };

export default async function CoursesPage() {
  const [courses, auth] = await Promise.all([getCourses(), getAuthState()]);
  const byTerm = courses.reduce<Record<string, typeof courses>>((acc, c) => {
    (acc[c.term] ??= []).push(c);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle={
          auth.authed
            ? "The subjects you're enrolled in this term."
            : "All courses you're enrolled in or teaching."
        }
      />

      {/* Signed in but nothing registered yet */}
      {auth.authed && courses.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <BookOpen className="h-6 w-6" />
          </span>
          <div>
            <p className="font-semibold text-ink">No courses yet</p>
            <p className="mt-1 text-sm text-ink-muted">
              Subjects are assigned by the academy office. Once you&apos;re
              enrolled, they&apos;ll appear here as your courses.
            </p>
          </div>
        </div>
      ) : (
        Object.entries(byTerm).map(([term, list]) => (
          <section key={term} className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">
              {term}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
