import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { CourseCard } from "@/components/dashboard/CourseCard";
import { getCourses } from "@/lib/data";

export const metadata = { title: "Courses" };

export default async function CoursesPage() {
  const courses = await getCourses();
  const byTerm = courses.reduce<Record<string, typeof courses>>((acc, c) => {
    (acc[c.term] ??= []).push(c);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle="All courses you're enrolled in or teaching."
        action={
          <Link
            href="#"
            className="focus-ring rounded-lg border border-black/10 bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-subtle"
          >
            Edit list
          </Link>
        }
      />

      {Object.entries(byTerm).map(([term, list]) => (
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
      ))}
    </>
  );
}
