"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { Widget } from "@/components/ui/Widget";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/Badge";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { getSignedInUserId } from "@/lib/study-guides-db";
import {
  addOfficeHourSlot,
  bookOfficeHour,
  cancelOfficeHour,
  fetchCourseOfficeHours,
  fetchProfileNames,
  removeOfficeHourSlot,
  type OfficeHourSlot,
} from "@/lib/office-hours-db";
import type { Course } from "@/lib/types";

type Draft = { date: string; startTime: string; endTime: string; location: string };

const emptyDraft: Draft = {
  date: "",
  startTime: "09:00",
  endTime: "10:00",
  location: "",
};

function slotLabel(s: OfficeHourSlot): string {
  const start = new Date(s.startsAt);
  const end = new Date(s.endsAt);
  const date = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time(start)}–${time(end)}${s.location ? ` · ${s.location}` : ""}`;
}

/** Office-hour booking (migration 0033). Instructors publish/delete slots and
 *  see who booked; course-mates book an open slot or cancel their own. Renders
 *  nothing for the anonymous demo (no seed) unless a signed-in teacher is
 *  present. */
export function OfficeHoursWidget({
  course,
  slots: initial,
}: {
  course: Course;
  slots: OfficeHourSlot[];
}) {
  const { role, hydrated, locked } = useRole();
  const signedIn = locked; // a real account is signed in
  const canManage = hydrated && signedIn && canTeach(role);

  const [slots, setSlots] = useState(initial);
  const [myId, setMyId] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pubNote, setPubNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSignedInUserId().then((id) => {
      if (alive) setMyId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Instructor sees the booker's name; resolve ids under RLS.
  const bookedIds = useMemo(
    () =>
      slots
        .map((s) => s.bookedBy)
        .filter((id): id is string => Boolean(id)),
    [slots],
  );
  useEffect(() => {
    if (!canManage || bookedIds.length === 0) return;
    let alive = true;
    fetchProfileNames(bookedIds).then((map) => {
      if (alive) setNames(map);
    });
    return () => {
      alive = false;
    };
  }, [canManage, bookedIds]);

  async function refresh() {
    const fresh = await fetchCourseOfficeHours(course.id);
    if (fresh) setSlots(fresh);
  }

  async function book(id: string) {
    // Optimistic — a concurrent booker can still win the row (RPC guard).
    setSlots((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, bookedBy: myId ?? "me", bookedAt: new Date().toISOString() }
          : s,
      ),
    );
    setPubNote(null);
    if (await bookOfficeHour(id)) return;
    await refresh();
    setPubNote("That slot was just taken — here's the latest availability.");
  }

  async function cancel(id: string) {
    if (await cancelOfficeHour(id)) {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, bookedBy: undefined, bookedAt: undefined } : s,
        ),
      );
      setPubNote(null);
      return;
    }
    await refresh();
    setPubNote("Couldn't cancel that booking — try again in a moment.");
  }

  async function addSlot() {
    if (!draft.date || !draft.startTime || !draft.endTime) return;
    const startsAt = new Date(`${draft.date}T${draft.startTime}`).toISOString();
    const endsAt = new Date(`${draft.date}T${draft.endTime}`).toISOString();
    const created = await addOfficeHourSlot(course.id, {
      startsAt,
      endsAt,
      location: draft.location,
    });
    if (created) {
      setSlots((prev) =>
        [...prev, created].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      );
      setDraft(emptyDraft);
      setPubNote(null);
      return;
    }
    setPubNote("Couldn't save that slot — try again in a moment.");
  }

  async function removeSlot(id: string) {
    if (await removeOfficeHourSlot(id)) {
      setSlots((prev) => prev.filter((s) => s.id !== id));
      setPubNote(null);
      return;
    }
    setPubNote("Couldn't remove that slot — try again in a moment.");
  }

  // Office hours are a real-accounts feature — no demo seed. Hide entirely when
  // there's nothing to show and the viewer can't publish.
  if (slots.length === 0 && !canManage) return null;

  return (
    <>
      <Widget
        title="Office hours"
        icon={<CalendarClock className="h-4 w-4 text-brand-600" />}
        action={
          canManage ? (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add slots
            </Button>
          ) : undefined
        }
      >
        {pubNote && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            {pubNote}
          </p>
        )}
        {slots.length === 0 ? (
          <p className="text-sm text-ink-faint">No office hours posted yet.</p>
        ) : (
          <ul className="space-y-2">
            {slots.map((s) => {
              const mine = Boolean(myId && s.bookedBy === myId);
              const taken = Boolean(s.bookedBy);
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
                >
                  <span className="min-w-0 text-ink">
                    {slotLabel(s)}
                    {canManage && taken && (
                      <span className="block text-xs text-ink-faint">
                        Booked by {names[s.bookedBy!] || "a course-mate"}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {canManage ? (
                      <>
                        {taken && <Badge tone="info">Booked</Badge>}
                        <button
                          onClick={() => removeSlot(s.id)}
                          className="focus-ring rounded-md p-1 text-ink-faint hover:text-rose-600"
                          aria-label="Delete slot"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : mine ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cancel(s.id)}
                      >
                        Booked · Cancel
                      </Button>
                    ) : taken ? (
                      <Badge tone="neutral">Taken</Badge>
                    ) : signedIn ? (
                      <Button size="sm" onClick={() => book(s.id)}>
                        Book
                      </Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Widget>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add office-hour slots"
        description={`Open times students can book for ${course.code}.`}
        footer={
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date *">
              <Input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </Field>
            <Field label="Location">
              <Input
                value={draft.location}
                onChange={(e) =>
                  setDraft({ ...draft, location: e.target.value })
                }
                placeholder="Room 204 / video link"
              />
            </Field>
            <Field label="Start *">
              <Input
                type="time"
                value={draft.startTime}
                onChange={(e) =>
                  setDraft({ ...draft, startTime: e.target.value })
                }
              />
            </Field>
            <Field label="End *">
              <Input
                type="time"
                value={draft.endTime}
                onChange={(e) =>
                  setDraft({ ...draft, endTime: e.target.value })
                }
              />
            </Field>
          </div>
          <Button
            onClick={addSlot}
            disabled={!draft.date || !draft.startTime || !draft.endTime}
          >
            <Plus className="h-4 w-4" /> Add slot
          </Button>
        </div>
      </Modal>
    </>
  );
}
