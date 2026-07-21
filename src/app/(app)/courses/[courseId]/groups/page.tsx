import { notFound } from "next/navigation";
import { CourseGroupsBoard } from "@/components/courses/CourseGroupsBoard";
import { getCourse } from "@/lib/data";

export const metadata = { title: "Groups" };

export default async function CourseGroupsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = await getCourse(courseId);
  if (!course) notFound();

  return <CourseGroupsBoard course={course} />;
}
