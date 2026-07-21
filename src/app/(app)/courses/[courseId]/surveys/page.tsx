import { notFound } from "next/navigation";
import { CourseSurveysBoard } from "@/components/courses/CourseSurveysBoard";
import { getCourse } from "@/lib/data";

export const metadata = { title: "Surveys" };

export default async function CourseSurveysPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = await getCourse(courseId);
  if (!course) notFound();

  return <CourseSurveysBoard course={course} />;
}
