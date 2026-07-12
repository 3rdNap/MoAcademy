"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { courseNav, type CourseNavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

// Syllabus sits right after Home, mirroring Canvas. Injected here (rather than
// in the shared nav list) to keep the change scoped to the course tab bar.
const navItems: CourseNavItem[] = courseNav.flatMap((item) =>
  item.segment === ""
    ? [item, { label: "Syllabus", segment: "syllabus" }]
    : [item],
);

/**
 * Canvas-style left course navigation. Highlights the active section based on
 * the current path segment.
 */
export function CourseNav({
  courseId,
  color,
}: {
  courseId: string;
  color: string;
}) {
  const pathname = usePathname();
  const base = `/courses/${courseId}`;

  return (
    <nav aria-label="Course" className="lg:sticky lg:top-20">
      <ul className="flex gap-1 overflow-x-auto border-b border-black/5 pb-2 lg:flex-col lg:gap-0.5 lg:border-b-0 lg:pb-0">
        {navItems.map((item) => {
          const href = item.segment ? `${base}/${item.segment}` : base;
          const active =
            item.segment === ""
              ? pathname === base
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={item.label}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring relative block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-ink"
                    : "text-ink-muted hover:bg-surface-subtle hover:text-ink",
                )}
              >
                {active && (
                  <span
                    className="absolute inset-y-1 left-0 hidden w-1 rounded-full lg:block"
                    style={{ backgroundColor: color }}
                  />
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
