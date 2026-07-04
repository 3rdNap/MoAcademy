import { notFound } from "next/navigation";
import { CourseAssignmentsBoard } from "@/components/courses/CourseAssignmentsBoard";
import { getAssignments, getCourse } from "@/lib/data";

export const metadata = { title: "Assignments" };

export default async function AssignmentsPage({
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

  return <CourseAssignmentsBoard course={course} seed={assignments} />;
}
