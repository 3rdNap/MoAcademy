import { notFound } from "next/navigation";
import { CourseAwardsBoard } from "@/components/courses/CourseAwardsBoard";
import { getCourse } from "@/lib/data";

export const metadata = { title: "Awards" };

export default async function CourseAwardsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = await getCourse(courseId);
  if (!course) notFound();

  return <CourseAwardsBoard course={course} />;
}
