"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Compass,
  FileText,
  GraduationCap,
  Home,
  Inbox,
  LayoutGrid,
  Library,
  ListChecks,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import * as seed from "@/lib/data/seed";
import { itemIcon, itemLabel } from "@/lib/itemMeta";
import { cn } from "@/lib/utils";

interface Entry {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
}

const pages: Entry[] = [
  { id: "p-dash", kind: "Page", title: "Dashboard", subtitle: "Home", href: "/dashboard", icon: Home },
  { id: "p-courses", kind: "Page", title: "Courses", subtitle: "All courses", href: "/courses", icon: LayoutGrid },
  { id: "p-roadmap", kind: "Page", title: "University Roadmap", subtitle: "Goals · Applications · Scholarships", href: "/roadmap", icon: Compass },
  { id: "p-calendar", kind: "Page", title: "Calendar", subtitle: "Agenda", href: "/calendar", icon: CalendarClock },
  { id: "p-inbox", kind: "Page", title: "Inbox", subtitle: "Messages", href: "/inbox", icon: Inbox },
  { id: "p-grades", kind: "Page", title: "Grades", subtitle: "Term standing", href: "/grades", icon: GraduationCap },
  { id: "p-guides", kind: "Page", title: "Study Guides", subtitle: "PDF guide library", href: "/study-guides", icon: Library },
  { id: "p-assistant", kind: "Page", title: "Assistant", subtitle: "Ask Mo, your AI tutor", href: "/assistant", icon: Sparkles },
  { id: "p-practice", kind: "Page", title: "Practice", subtitle: "Mo-made quizzes with instant marking", href: "/practice", icon: ListChecks },
];

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const index = useMemo<Entry[]>(() => {
    const courseCode = (id: string) =>
      seed.courses.find((c) => c.id === id)?.code ?? "";

    const courseEntries: Entry[] = seed.courses.map((c) => ({
      id: `c-${c.id}`,
      kind: "Course",
      title: c.name,
      subtitle: `${c.code} · ${c.term}`,
      href: `/courses/${c.id}`,
      icon: LayoutGrid,
    }));

    const assignmentEntries: Entry[] = seed.assignments.map((a) => ({
      id: `a-${a.id}`,
      kind: "Assignment",
      title: a.title,
      subtitle: `${courseCode(a.courseId)} · Assignment`,
      href: `/courses/${a.courseId}/assignments`,
      icon: itemIcon[a.type] ?? FileText,
    }));

    const itemEntries: Entry[] = seed.modules.flatMap((m) =>
      m.items.map((it) => ({
        id: `i-${it.id}`,
        kind: "Content",
        title: it.title,
        subtitle: `${courseCode(m.courseId)} · ${itemLabel[it.type]}`,
        href: `/courses/${m.courseId}/modules`,
        icon: itemIcon[it.type] ?? FileText,
      })),
    );

    return [...pages, ...courseEntries, ...assignmentEntries, ...itemEntries];
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return index
      .filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.subtitle.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, index]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && results[0]) {
      router.push(results[0].href);
      setOpen(false);
      setQuery("");
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative hidden lg:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search courses, assignments…"
        className="focus-ring h-9 w-64 rounded-full border border-black/10 bg-surface-subtle pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint"
        aria-label="Search"
        role="combobox"
        aria-expanded={open}
        aria-controls="global-search-results"
      />

      {open && query.trim() && (
        <div
          id="global-search-results"
          className="absolute left-0 top-full mt-1 w-96 overflow-hidden rounded-xl border border-black/5 bg-surface shadow-cardhover"
        >
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-faint">
              No matches for “{query.trim()}”.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1">
              {results.map((r) => {
                const Icon = r.icon;
                return (
                  <li key={r.id}>
                    <Link
                      href={r.href}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-surface-subtle"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-ink-muted">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {r.title}
                        </span>
                        <span className="block truncate text-xs text-ink-faint">
                          {r.subtitle}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          "bg-surface-sunken text-ink-muted",
                        )}
                      >
                        {r.kind}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
