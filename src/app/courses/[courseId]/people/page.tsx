import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { getCourse } from "@/lib/data";
import { currentUser } from "@/lib/data/seed";
import { initialsOf } from "@/lib/utils";

export const metadata = { title: "People" };

// A small representative roster. In a live deployment this comes from the
// enrollments table.
const roster = [
  "Thabo Nkosi",
  "Aisha Patel",
  "Liam O'Connor",
  "Zinhle Mthembu",
  "Noah Williams",
  "Fatima Hassan",
  "Ethan Brooks",
  "Lerato Sithole",
];

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = await getCourse(courseId);
  if (!course) notFound();

  const people = [
    { name: course.instructor, role: "Instructor" as const },
    { name: currentUser.name, role: "You" as const },
    ...roster.map((name) => ({ name, role: "Student" as const })),
  ];

  return (
    <>
      <PageHeader
        title="People"
        subtitle={`${people.length} members in ${course.code}.`}
      />

      <div className="card divide-y divide-black/5">
        {people.map((p) => (
          <div key={p.name} className="flex items-center gap-3 p-3.5">
            <Avatar
              initials={initialsOf(p.name)}
              color={
                p.role === "Instructor"
                  ? course.color
                  : p.role === "You"
                    ? "#10b6a3"
                    : "#8b94a3"
              }
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">{p.name}</p>
            </div>
            {p.role === "Instructor" ? (
              <Badge tone="brand">Instructor</Badge>
            ) : p.role === "You" ? (
              <Badge tone="success">You</Badge>
            ) : (
              <Badge tone="neutral">Student</Badge>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
