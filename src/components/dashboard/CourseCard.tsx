import Link from "next/link";
import { BookOpen, Megaphone, Users } from "lucide-react";
import type { Course } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";

/**
 * Canvas-style course card: colored banner header + quick links footer,
 * augmented with a Brightspace-style progress indicator.
 */
export function CourseCard({ course }: { course: Course }) {
  return (
    <article className="card group overflow-hidden transition-shadow hover:shadow-cardhover">
      <Link
        href={`/courses/${course.id}`}
        className="block h-24 w-full"
        style={{ backgroundColor: course.color }}
        aria-label={`Open ${course.name}`}
      >
        <div className="flex h-full items-start justify-end p-3">
          {!course.published && (
            <Badge tone="neutral" className="bg-white/85">
              Unpublished
            </Badge>
          )}
        </div>
      </Link>

      <div className="p-4">
        <Link href={`/courses/${course.id}`} className="focus-ring">
          <h3
            className="truncate font-semibold text-ink group-hover:text-brand-700"
            style={{ color: course.color }}
            title={course.name}
          >
            {course.name}
          </h3>
        </Link>
        <p className="mt-0.5 text-xs text-ink-faint">
          {course.code} · {course.term}
        </p>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-ink-muted">
            <span>Course progress</span>
            <span className="font-medium">{course.progress}%</span>
          </div>
          <ProgressBar value={course.progress} color={course.color} />
        </div>
      </div>

      <div className="flex items-center justify-around border-t border-black/5 px-2 py-1.5 text-ink-faint">
        <Link
          href={`/courses/${course.id}/announcements`}
          className="focus-ring flex flex-col items-center rounded-md p-1.5 hover:text-brand-600"
          aria-label="Announcements"
        >
          <Megaphone className="h-5 w-5" />
        </Link>
        <Link
          href={`/courses/${course.id}/modules`}
          className="focus-ring flex flex-col items-center rounded-md p-1.5 hover:text-brand-600"
          aria-label="Modules"
        >
          <BookOpen className="h-5 w-5" />
        </Link>
        <Link
          href={`/courses/${course.id}/people`}
          className="focus-ring flex flex-col items-center rounded-md p-1.5 hover:text-brand-600"
          aria-label="People"
        >
          <Users className="h-5 w-5" />
        </Link>
      </div>
    </article>
  );
}
