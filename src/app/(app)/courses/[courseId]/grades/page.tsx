import { notFound } from "next/navigation";
import { CourseGradesBoard } from "@/components/courses/CourseGradesBoard";
import { getAssignments, getCourse } from "@/lib/data";

export const metadata = { title: "Grades" };

export default async function CourseGradesPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, assignments] = await Promise.all([
    getCourse(courseId),
    getAssignments(courseId),
  ]);
  if (!course) notFound();

  return <CourseGradesBoard course={course} seed={assignments} />;
}
