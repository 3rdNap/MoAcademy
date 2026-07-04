import Link from "next/link";
import { ClipboardList, FileText, MessageCircleQuestion } from "lucide-react";
import type { Assignment, Course } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { daysUntil, formatDateTime } from "@/lib/utils";

function dueTone(dueAt: string) {
  const d = daysUntil(dueAt);
  if (d < 0) return { tone: "danger" as const, label: "Overdue" };
  if (d === 0) return { tone: "danger" as const, label: "Due today" };
  if (d === 1) return { tone: "warning" as const, label: "Due tomorrow" };
  return { tone: "neutral" as const, label: `${d} days` };
}

const typeIcon = {
  assignment: ClipboardList,
  quiz: MessageCircleQuestion,
  discussion: FileText,
} as const;

export function UpcomingList({
  items,
  courses,
}: {
  items: Assignment[];
  courses: Course[];
}) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-faint">
        Nothing due soon. Enjoy the breather. 🎉
      </p>
    );
  }

  return (
    <ul className="divide-y divide-black/5">
      {items.map((a) => {
        const course = courses.find((c) => c.id === a.courseId);
        const { tone, label } = dueTone(a.dueAt);
        const Icon = typeIcon[a.type as keyof typeof typeIcon] ?? ClipboardList;
        return (
          <li key={a.id}>
            <Link
              href={`/courses/${a.courseId}/assignments`}
              className="flex items-center gap-3 py-2.5 hover:bg-surface-subtle"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: course?.color ?? "#0284c7" }}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {a.title}
                </p>
                <p className="truncate text-xs text-ink-faint">
                  {course?.code} · {formatDateTime(a.dueAt)}
                </p>
              </div>
              <Badge tone={tone}>{label}</Badge>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
