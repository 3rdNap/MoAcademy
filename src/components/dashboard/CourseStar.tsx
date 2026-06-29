"use client";

import { Star } from "lucide-react";
import { useLocalCollection } from "@/lib/local-store";
import { cn } from "@/lib/utils";

/** A pin/favorite toggle overlaid on a course card. Persists in the browser. */
export function CourseStar({ courseId }: { courseId: string }) {
  const { items, add, remove, hydrated } = useLocalCollection<{ id: string }>(
    "moacademy.pinnedCourses",
    [],
  );
  // Render nothing until hydrated to avoid an SSR/client mismatch.
  if (!hydrated) return null;

  const pinned = items.some((i) => i.id === courseId);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (pinned) remove(courseId);
        else add({ id: courseId });
      }}
      aria-label={pinned ? "Unpin course" : "Pin course"}
      aria-pressed={pinned}
      className="focus-ring absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/15 backdrop-blur transition-colors hover:bg-black/25"
    >
      <Star
        className={cn(
          "h-4 w-4",
          pinned ? "fill-amber-400 text-amber-400" : "text-white",
        )}
      />
    </button>
  );
}
