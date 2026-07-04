import { notFound } from "next/navigation";
import { CourseAnnouncementsBoard } from "@/components/courses/CourseAnnouncementsBoard";
import { getAnnouncements, getCourse } from "@/lib/data";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, announcements] = await Promise.all([
    getCourse(courseId),
    getAnnouncements(courseId),
  ]);
  if (!course) notFound();

  return <CourseAnnouncementsBoard course={course} seed={announcements} />;
}
