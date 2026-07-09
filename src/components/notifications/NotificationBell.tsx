"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarClock,
  ClipboardList,
  GraduationCap,
  Mail,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { useLocalCollection } from "@/lib/local-store";
import { fetchRecentRemoteAnnouncements } from "@/lib/course-content-db";
import type { Announcement } from "@/lib/types";
import { inboxSeed } from "@/lib/inbox-seed";
import { seedApplications, seedScholarships } from "@/lib/roadmap/seed";
import * as seed from "@/lib/data/seed";
import { daysUntil, formatDate, relativeTime } from "@/lib/utils";
import type { ApplicationEntry, Scholarship } from "@/lib/roadmap/types";
import { cn } from "@/lib/utils";

interface Note {
  id: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  detail: string;
  href: string;
  at: string;
}

export function NotificationBell({ authed = false }: { authed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Reflect the user's own data where it lives in the browser.
  const read = useLocalCollection<{ id: string }>("moacademy.inbox.read", []);
  const apps = useLocalCollection<ApplicationEntry>(
    "moacademy.roadmap.applications",
    seedApplications,
  );
  const scholarships = useLocalCollection<Scholarship>(
    "moacademy.roadmap.scholarships",
    seedScholarships,
  );

  useEffect(() => setMounted(true), []);

  // Freshly published instructor announcements (shared table, last 7 days).
  const [published, setPublished] = useState<Announcement[]>([]);
  useEffect(() => {
    let alive = true;
    fetchRecentRemoteAnnouncements().then((a) => alive && a && setPublished(a));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const notes = useMemo<Note[]>(() => {
    const list: Note[] = [];

    // Unread inbox messages (demo only — real users have no seeded inbox).
    for (const m of authed ? [] : inboxSeed) {
      if (m.unread && !read.items.some((r) => r.id === m.id)) {
        list.push({
          id: `msg-${m.id}`,
          icon: Mail,
          tone: "bg-sky-50 text-sky-600",
          title: `New message from ${m.with}`,
          detail: m.subject,
          href: "/inbox",
          at: m.at,
        });
      }
    }

    // Roadmap deadlines closing within 14 days
    const deadlines = [
      ...apps.items
        .filter((a) => a.closesAt)
        .map((a) => ({
          id: `app-${a.id}`,
          title: `${a.institution} application closing`,
          href: "/roadmap/applications",
          closesAt: a.closesAt!,
        })),
      ...scholarships.items
        .filter((s) => s.closesAt)
        .map((s) => ({
          id: `sch-${s.id}`,
          title: `${s.name} closing`,
          href: "/roadmap/scholarships",
          closesAt: s.closesAt!,
        })),
    ];
    for (const d of deadlines) {
      const days = daysUntil(d.closesAt);
      if (days >= 0 && days <= 14) {
        list.push({
          id: d.id,
          icon: CalendarClock,
          tone: "bg-amber-50 text-amber-600",
          title: d.title,
          detail: `Closes ${formatDate(d.closesAt)} · ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`}`,
          href: d.href,
          at: d.closesAt,
        });
      }
    }

    // Assignments due within 7 days (demo seed only; real deadlines will come
    // from published assignments once instructors add them).
    for (const a of authed ? [] : seed.assignments) {
      const days = daysUntil(a.dueAt);
      if (a.status !== "graded" && days >= 0 && days <= 7) {
        const course = seed.courses.find((c) => c.id === a.courseId);
        list.push({
          id: `due-${a.id}`,
          icon: ClipboardList,
          tone: "bg-brand-50 text-brand-600",
          title: `${a.title} due`,
          detail: `${course?.code ?? ""} · ${formatDate(a.dueAt)}`,
          href: `/courses/${a.courseId}/assignments`,
          at: a.dueAt,
        });
      }
    }

    // Instructor announcements published in the last week
    for (const a of published) {
      const course = seed.courses.find((c) => c.id === a.courseId);
      list.push({
        id: `ann-${a.id}`,
        icon: Megaphone,
        tone: "bg-violet-50 text-violet-600",
        title: a.title,
        detail: `${course?.code ?? "Announcement"} · ${a.author}`,
        href: a.courseId ? `/courses/${a.courseId}/announcements` : "/dashboard",
        at: a.postedAt,
      });
    }

    // Recent grades (demo seed only).
    for (const ev of authed ? [] : seed.activity) {
      if (ev.kind === "grade") {
        list.push({
          id: `grade-${ev.id}`,
          icon: GraduationCap,
          tone: "bg-emerald-50 text-emerald-600",
          title: ev.title,
          detail: ev.detail,
          href: ev.courseId ? `/courses/${ev.courseId}/grades` : "/grades",
          at: ev.at,
        });
      }
    }

    return list.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [read.items, apps.items, scholarships.items, published, authed]);

  const count = mounted ? notes.length : 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="focus-ring relative flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunken"
        aria-label={`Notifications${count ? ` (${count} new)` : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-surface">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-80 overflow-hidden rounded-xl border border-black/5 bg-surface shadow-cardhover"
        >
          <header className="flex items-center justify-between border-b border-black/5 px-4 py-2.5">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {count > 0 && (
              <span className="text-xs font-medium text-ink-faint">
                {count} new
              </span>
            )}
          </header>

          {!mounted || notes.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-faint">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1">
              {notes.slice(0, 12).map((n) => {
                const Icon = n.icon;
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 px-4 py-2.5 hover:bg-surface-subtle"
                      role="menuitem"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          n.tone,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">
                          {n.title}
                        </span>
                        <span className="block truncate text-xs text-ink-muted">
                          {n.detail}
                        </span>
                        <span className="block text-[11px] text-ink-faint">
                          {relativeTime(n.at)}
                        </span>
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
