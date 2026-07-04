import { notFound } from "next/navigation";
import {
  DiscussionsBoard,
  type SeedThread,
} from "@/components/courses/DiscussionsBoard";
import { getCourse, getCurrentUser, getModules } from "@/lib/data";

export const metadata = { title: "Discussions" };

export default async function DiscussionsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, modules, user] = await Promise.all([
    getCourse(courseId),
    getModules(courseId),
    getCurrentUser(),
  ]);
  if (!course) notFound();

  // Surface discussion-type module items as starter threads.
  const seedThreads: SeedThread[] = modules.flatMap((m) =>
    m.items
      .filter((i) => i.type === "discussion")
      .map((i) => ({ id: i.id, title: i.title, module: m.title })),
  );

  return (
    <DiscussionsBoard
      course={course}
      userName={user.name}
      seedThreads={seedThreads}
    />
  );
}
