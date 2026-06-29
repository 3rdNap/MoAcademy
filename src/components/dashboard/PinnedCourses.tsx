"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { useLocalCollection } from "@/lib/local-store";
import type { Course } from "@/lib/types";

/** A "Pinned" strip on the dashboard showing the courses the user starred. */
export function PinnedCourses({ courses }: { courses: Course[] }) {
  const { items, hydrated } = useLocalCollection<{ id: string }>(
    "moacademy.pinnedCourses",
    [],
  );
  if (!hydrated) return null;

  const pinned = courses.filter((c) => items.some((i) => i.id === c.id));
  if (pinned.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-faint">
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        Pinned
      </h2>
      <div className="flex flex-wrap gap-2">
        {pinned.map((c) => (
          <Link
            key={c.id}
            href={`/courses/${c.id}`}
            className="focus-ring flex items-center gap-2 rounded-full border border-black/10 bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-subtle"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: c.color }}
            />
            {c.shortName}
            <span className="text-xs text-ink-faint">{c.code}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
