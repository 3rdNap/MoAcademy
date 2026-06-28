import {
  CircleCheckBig,
  Clock,
  GraduationCap,
  Megaphone,
  MessageSquare,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { ActivityEvent, ActivityKind } from "@/lib/types";
import { relativeTime } from "@/lib/utils";

const iconFor: Record<ActivityKind, LucideIcon> = {
  announcement: Megaphone,
  grade: GraduationCap,
  submission: CircleCheckBig,
  comment: MessageSquare,
  due_soon: Clock,
  enrollment: UserPlus,
};

const toneFor: Record<ActivityKind, string> = {
  announcement: "bg-sky-50 text-sky-600",
  grade: "bg-emerald-50 text-emerald-600",
  submission: "bg-brand-50 text-brand-600",
  comment: "bg-violet-50 text-violet-600",
  due_soon: "bg-amber-50 text-amber-600",
  enrollment: "bg-surface-sunken text-ink-muted",
};

/** Brightspace Pulse-style activity feed. */
export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <ol className="space-y-1">
      {events.map((ev) => {
        const Icon = iconFor[ev.kind];
        return (
          <li
            key={ev.id}
            className="flex gap-3 rounded-lg px-2 py-2 hover:bg-surface-subtle"
          >
            <span
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneFor[ev.kind]}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{ev.title}</p>
              <p className="truncate text-xs text-ink-muted">{ev.detail}</p>
            </div>
            <time className="whitespace-nowrap text-xs text-ink-faint">
              {relativeTime(ev.at)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
