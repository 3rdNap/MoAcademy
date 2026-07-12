import { notFound } from "next/navigation";
import { CourseAttendanceBoard } from "@/components/courses/CourseAttendanceBoard";
import { getCourse } from "@/lib/data";

export const metadata = { title: "Attendance" };

export default async function CourseAttendancePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = await getCourse(courseId);
  if (!course) notFound();

  return <CourseAttendanceBoard course={course} />;
}
