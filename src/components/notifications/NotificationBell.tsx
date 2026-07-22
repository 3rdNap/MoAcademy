"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
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
import { fetchMyMessages, type RemoteMessage } from "@/lib/inbox-db";
import { fetchMyAwards, type Badge, type BadgeAward } from "@/lib/awards-db";
import { fetchMyOpenSurveys, type Survey } from "@/lib/surveys-db";
import {
  fetchRemoteApplications,
  fetchRemoteScholarships,
} from "@/lib/roadmap-db";
import { getSignedInUserId } from "@/lib/study-guides-db";
import type { Announcement, Assignment } from "@/lib/types";
import type { RecentGrade } from "@/lib/data";
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

export function NotificationBell({
  authed = false,
  upcoming,
  recentGrades,
}: {
  authed?: boolean;
  upcoming?: Assignment[];
  recentGrades?: RecentGrade[];
}) {
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

  // Signed-in students' roadmap deadlines come from Supabase; anonymous local.
  const [remoteApps, setRemoteApps] = useState<ApplicationEntry[] | null>(null);
  const [remoteScholarships, setRemoteScholarships] = useState<
    Scholarship[] | null
  >(null);
  useEffect(() => {
    let alive = true;
    fetchRemoteApplications().then((r) => alive && setRemoteApps(r));
    fetchRemoteScholarships().then((r) => alive && setRemoteScholarships(r));
    return () => {
      alive = false;
    };
  }, []);

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

  // Unread real inbox messages received by the signed-in user.
  const [unreadMessages, setUnreadMessages] = useState<RemoteMessage[]>([]);
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    Promise.all([getSignedInUserId(), fetchMyMessages()]).then(([id, msgs]) => {
      if (!alive || !id || !msgs) return;
      setUnreadMessages(msgs.filter((m) => m.recipientId === id && !m.readAt));
    });
    return () => {
      alive = false;
    };
  }, [authed]);

  // Badges the signed-in student has earned (recent ones only, below).
  const [earnedBadges, setEarnedBadges] = useState<
    (BadgeAward & { badge: Badge })[]
  >([]);
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    fetchMyAwards().then((awards) => {
      if (!alive || !awards) return;
      const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
      setEarnedBadges(awards.filter((a) => +new Date(a.awardedAt) >= cutoff));
    });
    return () => {
      alive = false;
    };
  }, [authed]);

  // Surveys in the student's courses still awaiting their response.
  const [openSurveys, setOpenSurveys] = useState<Survey[]>([]);
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    fetchMyOpenSurveys().then((s) => alive && s && setOpenSurveys(s));
    return () => {
      alive = false;
    };
  }, [authed]);

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

    // Unread real messages (signed-in), newest 5 to avoid flooding the bell.
    if (authed) {
      const recent = [...unreadMessages]
        .sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt))
        .slice(0, 5);
      for (const m of recent) {
        list.push({
          id: `rmsg-${m.id}`,
          icon: Mail,
          tone: "bg-sky-50 text-sky-600",
          title: `New message from ${m.senderName}`,
          detail: m.subject || `${m.body.slice(0, 80)}${m.body.length > 80 ? "…" : ""}`,
          href: "/inbox",
          at: m.sentAt,
        });
      }
    }

    // Roadmap deadlines closing within 14 days
    const appItems = remoteApps ?? apps.items;
    const scholarshipItems = remoteScholarships ?? scholarships.items;
    const deadlines = [
      ...appItems
        .filter((a) => a.closesAt)
        .map((a) => ({
          id: `app-${a.id}`,
          title: `${a.institution} application closing`,
          href: "/roadmap/applications",
          closesAt: a.closesAt!,
        })),
      ...scholarshipItems
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

    // Assignments due within 7 days — real ones when signed in, demo seed
    // otherwise. getUpcoming() already filters out graded/past-due work but
    // doesn't cap the window, so keep the 7-day check here.
    for (const a of authed ? upcoming ?? [] : seed.assignments) {
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

    // Recent grades — real ones when signed in, demo seed otherwise.
    if (authed) {
      for (const g of recentGrades ?? []) {
        const course = seed.courses.find((c) => c.id === g.courseId);
        list.push({
          id: `grade-${g.id}`,
          icon: GraduationCap,
          tone: "bg-emerald-50 text-emerald-600",
          title: `${g.title} graded`,
          detail: `${course?.code ? `${course.code} · ` : ""}${g.score}/${g.points}`,
          href: `/courses/${g.courseId}/grades`,
          at: g.gradedAt,
        });
      }
    } else {
      for (const ev of seed.activity) {
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
    }

    // Badges earned recently (signed-in only), newest 5.
    if (authed) {
      for (const a of earnedBadges.slice(0, 5)) {
        const course = seed.courses.find((c) => c.id === a.badge.courseKey);
        list.push({
          id: `badge-${a.id}`,
          icon: Award,
          tone: "bg-emerald-50 text-emerald-600",
          title: `Badge earned: ${a.badge.name}`,
          detail: a.note || (course ? `Awarded in ${course.code}` : "Achievement unlocked"),
          href: "/report",
          at: a.awardedAt,
        });
      }
    }

    // Surveys still awaiting the student's response (signed-in only), first 5.
    if (authed) {
      const now = new Date().toISOString();
      for (const s of openSurveys.slice(0, 5)) {
        list.push({
          id: `survey-${s.id}`,
          icon: ClipboardList,
          tone: "bg-brand-50 text-brand-600",
          title: `Survey: ${s.title}`,
          detail: `Awaiting your response${s.closesAt ? ` · closes ${relativeTime(s.closesAt)}` : ""}`,
          href: `/courses/${s.courseKey}/surveys`,
          at: s.closesAt ?? now,
        });
      }
    }

    return list.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [read.items, apps.items, scholarships.items, remoteApps, remoteScholarships, published, unreadMessages, earnedBadges, openSurveys, authed, upcoming, recentGrades]);

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
