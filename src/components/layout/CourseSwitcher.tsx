"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Grip } from "lucide-react";
import type { Course } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Brightspace "waffle"-style course selector dropdown.
 */
export function CourseSwitcher({ courses }: { courses: Course[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "focus-ring flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-sunken",
          open && "bg-surface-sunken",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Grip className="h-4 w-4" />
        Courses
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 w-72 overflow-hidden rounded-xl border border-black/5 bg-surface shadow-cardhover"
        >
          <p className="border-b border-black/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Fall 2026
          </p>
          <ul className="max-h-80 overflow-y-auto py-1">
            {courses.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/courses/${c.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-subtle"
                  role="menuitem"
                >
                  <span
                    className="h-7 w-7 shrink-0 rounded-md"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">
                      {c.shortName}
                    </span>
                    <span className="block truncate text-xs text-ink-faint">
                      {c.code}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/courses"
            onClick={() => setOpen(false)}
            className="block border-t border-black/5 px-4 py-2.5 text-sm font-medium text-brand-600 hover:bg-surface-subtle"
          >
            All courses →
          </Link>
        </div>
      )}
    </div>
  );
}
