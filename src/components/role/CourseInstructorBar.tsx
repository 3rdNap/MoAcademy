"use client";

import {
  BarChart3,
  Eye,
  PlusCircle,
  Send,
  Settings,
  Users,
} from "lucide-react";
import { InstructorOnly } from "./InstructorOnly";

/** Instructor-only toolbar shown on course pages. The actions are the teaching
 *  surface; wiring them to real authoring is the next milestone. */
export function CourseInstructorBar({ published }: { published: boolean }) {
  const tools = [
    { label: "Add content", icon: PlusCircle },
    { label: "Gradebook", icon: BarChart3 },
    { label: "People", icon: Users },
    { label: "Student view", icon: Eye },
    { label: "Settings", icon: Settings },
  ];

  return (
    <InstructorOnly>
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/70 px-3 py-2.5 dark:border-brand-500/20 dark:bg-brand-500/10">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
          Instructor tools
        </span>
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.label}
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface-subtle"
            >
              <Icon className="h-3.5 w-3.5 text-brand-600" />
              {t.label}
            </button>
          );
        })}
        <button
          className="focus-ring ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          <Send className="h-3.5 w-3.5" />
          {published ? "Published" : "Publish course"}
        </button>
      </div>
    </InstructorOnly>
  );
}
