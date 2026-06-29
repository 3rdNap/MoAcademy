import { notFound } from "next/navigation";
import { CourseModulesBoard } from "@/components/courses/CourseModulesBoard";
import { getCourse, getModules } from "@/lib/data";

export const metadata = { title: "Modules" };

export default async function ModulesPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, modules] = await Promise.all([
    getCourse(courseId),
    getModules(courseId),
  ]);
  if (!course) notFound();

  return <CourseModulesBoard course={course} seed={modules} />;
}
