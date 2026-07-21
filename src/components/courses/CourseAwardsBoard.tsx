"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/form";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { fetchCourseRoster, type RosterStudent } from "@/lib/gradebook-db";
import {
  awardBadge,
  createBadge,
  fetchCourseAwards,
  fetchCourseBadges,
  fetchMyAwards,
  removeBadge,
  revokeAward,
  type Badge as BadgeDef,
  type BadgeAward,
} from "@/lib/awards-db";
import { initialsOf } from "@/lib/utils";
import type { Course } from "@/lib/types";

// A small palette for the emoji picker — a text input covers everything else.
const ICON_PRESETS = ["🏅", "⭐", "🎯", "📚", "🔬", "✍️", "🏆", "💡"];

export function CourseAwardsBoard({ course }: { course: Course }) {
  const { role, hydrated } = useRole();
  const teaching = hydrated && canTeach(role);

  if (!hydrated) {
    return (
      <>
        <PageHeader title="Awards" subtitle={`Awards in ${course.code}.`} />
        <div className="card p-6 text-sm text-ink-muted">Loading…</div>
      </>
    );
  }
  if (!teaching) return <StudentAwards course={course} />;
  return <InstructorAwards course={course} />;
}

/* --------------------------- Instructor view ---------------------------- */

function InstructorAwards({ course }: { course: Course }) {
  const [roster, setRoster] = useState<RosterStudent[] | null | undefined>(
    undefined,
  );
  const [badges, setBadges] = useState<BadgeDef[] | undefined>(undefined);
  const [awards, setAwards] = useState<BadgeAward[]>([]);
  const [note, setNote] = useState<string | null>(null);

  // New-badge form controls.
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🏅");

  useEffect(() => {
    let alive = true;
    fetchCourseRoster(course.id).then((r) => alive && setRoster(r));
    fetchCourseBadges(course.id).then((b) => alive && setBadges(b ?? []));
    fetchCourseAwards(course.id).then((a) => alive && setAwards(a ?? []));
    return () => {
      alive = false;
    };
  }, [course.id]);

  const byId = useMemo(() => {
    const m = new Map<string, RosterStudent>();
    for (const s of roster ?? []) m.set(s.id, s);
    return m;
  }, [roster]);

  // Recipients per badge, in award order.
  const awardsByBadge = useMemo(() => {
    const m = new Map<string, BadgeAward[]>();
    for (const a of awards) {
      const arr = m.get(a.badgeId) ?? [];
      arr.push(a);
      m.set(a.badgeId, arr);
    }
    return m;
  }, [awards]);

  // Real mode requires a signed-in teaching account for this subject.
  if (roster === undefined || badges === undefined) {
    return (
      <>
        <PageHeader title="Awards" subtitle={`Awards in ${course.code}.`} />
        <div className="card p-6 text-sm text-ink-muted">Loading awards…</div>
      </>
    );
  }
  if (roster === null) {
    return (
      <>
        <PageHeader title="Awards" subtitle={`Awards in ${course.code}.`} />
        <div className="card flex flex-col items-start gap-2 p-6">
          <p className="font-semibold text-ink">Sign in to manage awards</p>
          <p className="text-sm text-ink-muted">
            Awards need a signed-in teaching account for this subject. Once
            you&apos;re signed in as this course&apos;s instructor, your enrolled
            roster appears here to recognise with badges.
          </p>
        </div>
      </>
    );
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setNote(null);
    const created = await createBadge(course.id, {
      name: trimmed,
      description: description.trim(),
      icon: icon.trim() || "🏅",
    });
    if (!created) {
      setNote("Couldn't create the badge — a teaching account is required.");
      return;
    }
    setBadges((prev) => [...(prev ?? []), created]);
    setName("");
    setDescription("");
    setIcon("🏅");
  }

  async function handleDelete(id: string) {
    const previous = badges!;
    const previousAwards = awards;
    setBadges((prev) => (prev ?? []).filter((b) => b.id !== id));
    setAwards((prev) => prev.filter((a) => a.badgeId !== id));
    const ok = await removeBadge(id);
    if (!ok) {
      setBadges(previous);
      setAwards(previousAwards);
      setNote("Couldn't delete the badge.");
    }
  }

  async function handleAward(badgeId: string, studentId: string, awardNote: string) {
    if (!studentId) return;
    if (awards.some((a) => a.badgeId === badgeId && a.studentId === studentId)) {
      setNote("That student already has this badge.");
      return;
    }
    const optimistic: BadgeAward = {
      id: `pending-${badgeId}-${studentId}`,
      badgeId,
      studentId,
      note: awardNote,
      awardedAt: new Date().toISOString(),
    };
    setAwards((prev) => [...prev, optimistic]);
    const ok = await awardBadge(badgeId, studentId, awardNote);
    if (!ok) {
      setAwards((prev) => prev.filter((a) => a.id !== optimistic.id));
      setNote("Couldn't award the badge.");
    }
  }

  async function handleRevoke(badgeId: string, studentId: string) {
    const previous = awards;
    setAwards((prev) =>
      prev.filter((a) => !(a.badgeId === badgeId && a.studentId === studentId)),
    );
    const ok = await revokeAward(badgeId, studentId);
    if (!ok) {
      setAwards(previous);
      setNote("Couldn't revoke the award.");
    }
  }

  return (
    <>
      <PageHeader
        title="Awards"
        subtitle={`${badges.length} badge${badges.length === 1 ? "" : "s"} in ${course.code}. Recognise students for their achievements.`}
      />

      <div className="card mb-4 flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-muted">Icon</span>
            <div className="flex items-center gap-2">
              <Input
                value={icon}
                aria-label="Badge icon"
                className="w-14 text-center text-lg"
                onChange={(e) => setIcon(e.target.value)}
              />
              <div className="flex flex-wrap gap-1">
                {ICON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-label={`Use ${preset}`}
                    className="focus-ring rounded-md px-1.5 py-1 text-lg hover:bg-surface-subtle"
                    onClick={() => setIcon(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Field label="Badge name" className="w-56">
            <Input
              value={name}
              placeholder="e.g. Top of the class"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </Field>
          <Field label="Description" className="min-w-56 flex-1">
            <Input
              value={description}
              placeholder="What it recognises"
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </Field>
          <Button onClick={handleCreate} disabled={!name.trim()}>
            New badge
          </Button>
        </div>
      </div>

      {note && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {note}
        </p>
      )}

      {badges.length === 0 ? (
        <div className="card p-6 text-sm text-ink-muted">
          No badges yet. Create one above to start recognising students.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {badges.map((b) => (
            <BadgeCard
              key={b.id}
              badge={b}
              recipients={awardsByBadge.get(b.id) ?? []}
              byId={byId}
              roster={roster}
              onDelete={handleDelete}
              onAward={handleAward}
              onRevoke={handleRevoke}
            />
          ))}
        </div>
      )}
    </>
  );
}

function BadgeCard({
  badge,
  recipients,
  byId,
  roster,
  onDelete,
  onAward,
  onRevoke,
}: {
  badge: BadgeDef;
  recipients: BadgeAward[];
  byId: Map<string, RosterStudent>;
  roster: RosterStudent[];
  onDelete: (id: string) => void;
  onAward: (badgeId: string, studentId: string, note: string) => void;
  onRevoke: (badgeId: string, studentId: string) => void;
}) {
  const [pick, setPick] = useState("");
  const [awardNote, setAwardNote] = useState("");

  // Enrolled students who don't already hold this badge.
  const holders = new Set(recipients.map((a) => a.studentId));
  const candidates = roster.filter((s) => !holders.has(s.id));

  function submit() {
    if (!pick) return;
    onAward(badge.id, pick, awardNote.trim());
    setPick("");
    setAwardNote("");
  }

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none" aria-hidden>
          {badge.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{badge.name}</p>
          {badge.description && (
            <p className="text-sm text-ink-muted">{badge.description}</p>
          )}
        </div>
        <Badge tone={recipients.length ? "success" : "neutral"}>
          {recipients.length} earned
        </Badge>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(badge.id)}
          aria-label={`Delete ${badge.name}`}
        >
          Delete
        </Button>
      </div>

      {recipients.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {recipients.map((a) => {
            const s = byId.get(a.studentId);
            return (
              <li key={a.studentId} className="flex items-center gap-2">
                <Avatar
                  initials={initialsOf(s?.name ?? "?")}
                  color={s?.avatarColor ?? "#0284c7"}
                  size={26}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {s?.name ?? "Unknown student"}
                  </span>
                  {a.note && (
                    <span className="block truncate text-xs text-ink-faint">
                      {a.note}
                    </span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRevoke(badge.id, a.studentId)}
                  aria-label={`Revoke ${badge.name} from ${s?.name ?? "student"}`}
                >
                  Revoke
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {candidates.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-black/5 pt-3 dark:border-white/5">
          <Select
            aria-label="Award to"
            className="w-40"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
          >
            <option value="">Award to…</option>
            {candidates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input
            aria-label="Award note"
            className="min-w-40 flex-1"
            placeholder="Optional note"
            value={awardNote}
            onChange={(e) => setAwardNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
          <Button size="sm" onClick={submit} disabled={!pick}>
            Award
          </Button>
        </div>
      ) : (
        <p className="border-t border-black/5 pt-3 text-xs text-ink-faint dark:border-white/5">
          Every enrolled student has earned this badge.
        </p>
      )}
    </div>
  );
}

/* ----------------------------- Student view ----------------------------- */

function StudentAwards({ course }: { course: Course }) {
  const [awards, setAwards] = useState<
    (BadgeAward & { badge: BadgeDef })[] | null | undefined
  >(undefined);

  useEffect(() => {
    let alive = true;
    fetchMyAwards().then((a) => alive && setAwards(a));
    return () => {
      alive = false;
    };
  }, []);

  if (awards === undefined) {
    return (
      <>
        <PageHeader title="Awards" subtitle={`Your awards in ${course.code}.`} />
        <div className="card p-6 text-sm text-ink-muted">Loading…</div>
      </>
    );
  }

  // Signed-out / anonymous: there is no local demo for awards.
  if (awards === null) {
    return (
      <>
        <PageHeader title="Awards" subtitle={`Your awards in ${course.code}.`} />
        <div className="card flex flex-col items-start gap-2 p-6">
          <p className="font-semibold text-ink">Sign in to see your awards</p>
          <p className="text-sm text-ink-muted">
            Awards are given by your instructor. Sign in to see the badges
            you&apos;ve earned in {course.code}.
          </p>
        </div>
      </>
    );
  }

  const mine = awards.filter((a) => a.badge.courseKey === course.id);

  return (
    <>
      <PageHeader title="Awards" subtitle={`Your awards in ${course.code}.`} />
      {mine.length === 0 ? (
        <div className="card flex flex-col items-start gap-2 p-6">
          <p className="font-semibold text-ink">No awards in this course yet</p>
          <p className="text-sm text-ink-muted">
            Keep it up! When your instructor recognises your work, your badges
            will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((a) => (
            <div key={a.id} className="card flex flex-col items-center gap-2 p-6 text-center">
              <span className="text-5xl leading-none" aria-hidden>
                {a.badge.icon}
              </span>
              <p className="font-semibold text-ink">{a.badge.name}</p>
              {a.badge.description && (
                <p className="text-sm text-ink-muted">{a.badge.description}</p>
              )}
              {a.note && (
                <p className="text-xs italic text-ink-faint">“{a.note}”</p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
