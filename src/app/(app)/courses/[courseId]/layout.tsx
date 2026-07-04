import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CourseNav } from "@/components/layout/CourseNav";
import { CourseInstructorBar } from "@/components/role/CourseInstructorBar";
import { Badge } from "@/components/ui/Badge";
import { getCourse } from "@/lib/data";

export default async function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = await getCourse(courseId);
  if (!course) notFound();

  return (
    <div>
      {/* Course banner */}
      <div
        className="mb-5 overflow-hidden rounded-xl px-5 py-5 text-white shadow-card"
        style={{ backgroundColor: course.color }}
      >
        <Link
          href="/courses"
          className="focus-ring mb-2 inline-flex items-center gap-1 text-sm font-medium text-white/80 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          All courses
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{course.name}</h1>
          {!course.published && (
            <Badge tone="neutral" className="bg-white/85">
              Unpublished
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-white/85">
          {course.code} · {course.term} · {course.instructor}
        </p>
      </div>

      <CourseInstructorBar published={course.published} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside>
          <CourseNav courseId={course.id} color={course.color} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
