import { notFound } from "next/navigation";
import { CourseAssignmentsBoard } from "@/components/courses/CourseAssignmentsBoard";
import { getAssignments, getCourse, getCourseRoster } from "@/lib/data";

export const metadata = { title: "Assignments" };

export default async function AssignmentsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, assignments, classRoster] = await Promise.all([
    getCourse(courseId),
    getAssignments(courseId),
    getCourseRoster(courseId),
  ]);
  if (!course) notFound();

  // The enrolled class, so a teaching account can review who handed what in.
  const students = (classRoster?.students ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    avatarColor: s.avatarColor,
  }));

  return (
    <CourseAssignmentsBoard
      course={course}
      seed={assignments}
      students={students}
    />
  );
}
