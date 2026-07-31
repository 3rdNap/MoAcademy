import { notFound } from "next/navigation";
import { CourseGradesBoard } from "@/components/courses/CourseGradesBoard";
import {
  getAssignments,
  getAuthState,
  getCourse,
  getCourseRoster,
} from "@/lib/data";

export const metadata = { title: "Grades" };

export default async function CourseGradesPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, assignments, classRoster, { authed }] = await Promise.all([
    getCourse(courseId),
    getAssignments(courseId),
    getCourseRoster(courseId),
    getAuthState(),
  ]);
  if (!course) notFound();

  // The gradebook grades the real enrolled class. Anonymous visitors keep the
  // demo class (null students); a signed-in instructor with an empty class gets
  // an empty gradebook rather than fictional students.
  const students = classRoster
    ? classRoster.students.map((s) => ({
        id: s.id,
        name: s.name,
        avatarColor: s.avatarColor,
      }))
    : authed
      ? []
      : null;

  return (
    <CourseGradesBoard
      course={course}
      seed={assignments}
      students={students}
    />
  );
}
