import { notFound } from "next/navigation";
import { CourseInsightsBoard } from "@/components/courses/CourseInsightsBoard";
import { getCourse, getCurrentUser } from "@/lib/data";

export const metadata = { title: "Insights" };

export default async function CourseInsightsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, user] = await Promise.all([getCourse(courseId), getCurrentUser()]);
  if (!course) notFound();

  return <CourseInsightsBoard course={course} senderName={user.name} />;
}
