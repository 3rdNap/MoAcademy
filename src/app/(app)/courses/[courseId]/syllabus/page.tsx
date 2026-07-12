import { notFound } from "next/navigation";
import { CourseSyllabusBoard } from "@/components/courses/CourseSyllabusBoard";
import { getCourse, getCurrentUser, getSyllabus } from "@/lib/data";

export const metadata = { title: "Syllabus" };

export default async function SyllabusPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, initial, user] = await Promise.all([
    getCourse(courseId),
    getSyllabus(courseId),
    getCurrentUser(),
  ]);
  if (!course) notFound();

  return (
    <CourseSyllabusBoard course={course} initial={initial} userName={user.name} />
  );
}
