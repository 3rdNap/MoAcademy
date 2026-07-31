import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import {
  getAuthState,
  getCourse,
  getCourseRoster,
  getCurrentUser,
} from "@/lib/data";
import { currentUser } from "@/lib/data/seed";
import { roster } from "@/lib/roster";
import { initialsOf } from "@/lib/utils";

export const metadata = { title: "People" };

/** One row of the class list, in the order we show it. */
interface Member {
  key: string;
  name: string;
  email: string | null;
  color: string;
  role: "Instructor" | "Student";
  isYou: boolean;
}

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const [course, classRoster, me, { authed }] = await Promise.all([
    getCourse(courseId),
    getCourseRoster(courseId),
    getCurrentUser(),
    getAuthState(),
  ]);
  if (!course) notFound();

  // Real enrolments for a signed-in user; the demo class only for visitors
  // browsing anonymously. A signed-in user never sees the seed roster.
  let people: Member[];
  if (classRoster) {
    people = [...classRoster.instructors, ...classRoster.students].map((m) => ({
      key: m.id,
      name: m.name,
      email: m.email,
      color: m.role === "instructor" ? course.color : m.avatarColor,
      role: m.role === "instructor" ? "Instructor" : "Student",
      isYou: m.id === me.id,
    }));
  } else if (authed) {
    people = [
      {
        key: me.id,
        name: me.name,
        email: me.email,
        color: me.avatarColor,
        role: me.role === "instructor" ? "Instructor" : "Student",
        isYou: true,
      },
    ];
  } else {
    people = [
      {
        key: course.instructor,
        name: course.instructor,
        email: null,
        color: course.color,
        role: "Instructor",
        isYou: false,
      },
      {
        key: currentUser.name,
        name: currentUser.name,
        email: null,
        color: "#10b6a3",
        role: "Student",
        isYou: true,
      },
      ...roster.map((s) => ({
        key: s.id,
        name: s.name,
        email: null,
        color: "#8b94a3",
        role: "Student" as const,
        isYou: false,
      })),
    ];
  }

  const students = people.filter((p) => p.role === "Student").length;
  const alone = authed && !classRoster;

  return (
    <>
      <PageHeader
        title="People"
        subtitle={`${people.length} ${
          people.length === 1 ? "member" : "members"
        } in ${course.code} · ${students} ${
          students === 1 ? "student" : "students"
        }.`}
      />

      <div className="card divide-y divide-black/5">
        {people.map((p) => (
          <div key={p.key} className="flex items-center gap-3 p-3.5">
            <Avatar initials={initialsOf(p.name)} color={p.color} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{p.name}</p>
              {p.email && (
                <p className="truncate text-xs text-ink-faint">{p.email}</p>
              )}
            </div>
            {!p.isYou && (
              <Link
                href={`/inbox?to=${encodeURIComponent(p.name)}`}
                className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/10 px-2.5 text-xs font-medium text-ink-muted hover:bg-surface-subtle dark:border-white/10"
                aria-label={`Message ${p.name}`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Message
              </Link>
            )}
            {p.isYou ? (
              <Badge tone="success">You</Badge>
            ) : p.role === "Instructor" ? (
              <Badge tone="brand">Instructor</Badge>
            ) : (
              <Badge tone="neutral">Student</Badge>
            )}
          </div>
        ))}
      </div>

      {alone && (
        <div className="card mt-4 flex items-start gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <Users className="h-4 w-4" />
          </span>
          <p className="text-sm text-ink-muted">
            No one else is enrolled in {course.code} yet. Classmates and the
            subject&apos;s teacher appear here as an administrator enrols them.
          </p>
        </div>
      )}
    </>
  );
}
