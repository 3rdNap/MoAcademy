"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { useLocalCollection, newId } from "@/lib/local-store";
import {
  addRemoteCalendarEvent,
  fetchMyCalendarEvents,
  removeRemoteCalendarEvent,
} from "@/lib/calendar-db";
import {
  fetchMeetingsForCourses,
  type CourseMeeting,
} from "@/lib/course-content-db";
import {
  fetchMyBookedOfficeHours,
  type OfficeHourSlot,
} from "@/lib/office-hours-db";
import { getSignedInUserId } from "@/lib/study-guides-db";
import { formatDateTime } from "@/lib/utils";
import type { CalendarEvent, Course } from "@/lib/types";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const typeTone: Record<
  CalendarEvent["type"],
  "brand" | "info" | "neutral" | "success"
> = {
  assignment: "brand",
  quiz: "info",
  event: "neutral",
  office_hours: "success",
};

type Draft = {
  id?: string;
  title: string;
  at: string; // datetime-local value
  type: CalendarEvent["type"];
};

const emptyDraft: Draft = { title: "", at: "", type: "event" };

export function CalendarBoard({
  seedEvents,
  courses,
}: {
  seedEvents: CalendarEvent[];
  courses: Course[];
}) {
  const personal = useLocalCollection<CalendarEvent>(
    "moacademy.calendar.events",
    [],
  );

  // Signed-in users get personal events from Supabase; null means
  // signed-out/offline, in which case we keep the browser-local behavior.
  const [remote, setRemote] = useState<CalendarEvent[] | null>(null);
  const [pubNote, setPubNote] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetchMyCalendarEvents().then((r) => {
      if (alive) setRemote(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  // One-time import of a hydrated local calendar into an empty remote one —
  // guarded so it only ever runs once both sides have resolved.
  const importedRef = useRef(false);
  useEffect(() => {
    if (importedRef.current) return;
    if (remote === null || remote.length > 0) return;
    if (!personal.hydrated || personal.items.length === 0) return;
    importedRef.current = true;
    (async () => {
      const created = await Promise.all(
        personal.items.map((e) =>
          addRemoteCalendarEvent({ courseId: e.courseId, title: e.title, at: e.at, type: e.type }),
        ),
      );
      const rows = created.filter((r): r is CalendarEvent => r !== null);
      if (rows.length > 0) setRemote(rows);
    })();
  }, [remote, personal.hydrated, personal.items]);

  const personalEvents = remote ?? personal.items;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  // Agenda list vs month grid. The preference persists; agenda first so the
  // server render matches the client's initial paint.
  const [view, setView] = useState<"agenda" | "month">("agenda");
  useEffect(() => {
    try {
      const v = window.localStorage.getItem("moacademy.calendar.view");
      if (v === "month") setView("month");
    } catch {
      /* default */
    }
  }, []);
  function switchView(v: "agenda" | "month") {
    setView(v);
    try {
      window.localStorage.setItem("moacademy.calendar.view", v);
    } catch {
      /* session only */
    }
  }

  // ----- Month view state -----
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // yyyy-mm-dd

  // Course meetings (migration 0030): fetched for the signed-in user's real
  // courses, then expanded into occurrences for the visible range below.
  // Anonymous demo (seed courses, signed out) is left unchanged.
  const [meetings, setMeetings] = useState<CourseMeeting[] | null>(null);
  // Office hours I've booked or (as instructor) own (migration 0033). Signed-in
  // only, same gating as meetings; timestamped rows, no occurrence expansion.
  const [officeHours, setOfficeHours] = useState<OfficeHourSlot[] | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const userId = await getSignedInUserId();
      if (!userId || courses.length === 0) return;
      const rows = await fetchMeetingsForCourses(courses.map((c) => c.id));
      if (alive) setMeetings(rows);
      const oh = await fetchMyBookedOfficeHours();
      if (alive) setOfficeHours(oh);
    })();
    return () => {
      alive = false;
    };
  }, [courses]);

  // Agenda = next 14 days from today; month = the displayed month.
  const rangeStart = useMemo(() => {
    if (view === "month") return new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [view, cursor]);
  const rangeEnd = useMemo(() => {
    if (view === "month") return new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + 13);
    return d;
  }, [view, cursor, rangeStart]);

  const meetingEvents = useMemo(() => {
    if (!meetings || meetings.length === 0) return [];
    const out: { e: CalendarEvent; location: string }[] = [];
    const day = new Date(rangeStart);
    while (day <= rangeEnd) {
      const weekday = day.getDay();
      for (const m of meetings) {
        if (m.weekday !== weekday) continue;
        const course = courses.find((c) => c.id === m.courseKey);
        const [h, min] = m.startTime.split(":").map(Number);
        const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min);
        out.push({
          e: {
            id: `meeting_${m.id}_${dayKey(day)}`,
            courseId: m.courseKey,
            title: `${course?.code ?? "Class"} class`,
            at: at.toISOString(),
            type: "event",
          },
          location: m.location,
        });
      }
      day.setDate(day.getDate() + 1);
    }
    return out;
  }, [meetings, rangeStart, rangeEnd, courses]);

  // Booked office hours flow like seedEvents (already timestamped).
  const officeHourEvents = useMemo(() => {
    if (!officeHours || officeHours.length === 0) return [];
    return officeHours.map((s) => {
      const course = courses.find((c) => c.id === s.courseKey);
      return {
        e: {
          id: `office_${s.id}`,
          courseId: s.courseKey,
          title: course ? `Office hours · ${course.code}` : "Office hours",
          at: s.startsAt,
          type: "office_hours" as const,
        },
        location: s.location,
      };
    });
  }, [officeHours, courses]);

  const allEvents = useMemo(
    () => [
      ...seedEvents.map((e) => ({ e, local: false, location: "" })),
      ...personalEvents.map((e) => ({ e, local: true, location: "" })),
      ...meetingEvents.map((row) => ({ e: row.e, local: false, location: row.location })),
      ...officeHourEvents.map((row) => ({ e: row.e, local: false, location: row.location })),
    ],
    [seedEvents, personalEvents, meetingEvents, officeHourEvents],
  );

  const grouped = useMemo(() => {
    const all = [...allEvents].sort((a, b) => +new Date(a.e.at) - +new Date(b.e.at));

    return all.reduce<Record<string, typeof all>>((acc, row) => {
      const day = new Date(row.e.at).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      (acc[day] ??= []).push(row);
      return acc;
    }, {});
  }, [allEvents]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, typeof allEvents>();
    for (const row of allEvents) {
      const key = dayKey(new Date(row.e.at));
      (map.get(key) ?? map.set(key, []).get(key)!).push(row);
    }
    for (const list of map.values()) {
      list.sort((a, b) => +new Date(a.e.at) - +new Date(b.e.at));
    }
    return map;
  }, [allEvents]);

  // 6 weeks starting the Monday on/before the 1st of the cursor month.
  const monthCells = useMemo(() => {
    const first = new Date(cursor);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const todayKey = dayKey(new Date());
  const monthLabel = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function openCreate() {
    setDraft(emptyDraft);
    setOpen(true);
  }

  function openEdit(e: CalendarEvent) {
    setDraft({
      id: e.id,
      title: e.title,
      at: toLocalInput(e.at),
      type: e.type,
    });
    setOpen(true);
  }

  async function save() {
    if (!draft.title.trim() || !draft.at) return;
    const at = new Date(draft.at).toISOString();
    const payload = { title: draft.title.trim(), at, type: draft.type };

    if (draft.id) {
      if (remote !== null) {
        // No remote update endpoint (migration 0025) — recreate the row.
        const created = await addRemoteCalendarEvent(payload);
        if (created) {
          await removeRemoteCalendarEvent(draft.id);
          setRemote((prev) =>
            (prev ?? []).filter((e) => e.id !== draft.id).concat(created),
          );
        } else {
          setPubNote(
            "Couldn't update the event online — try again in a moment.",
          );
        }
        setOpen(false);
        return;
      }
      personal.update(draft.id, payload);
      setOpen(false);
      return;
    }

    if (remote !== null) {
      const created = await addRemoteCalendarEvent(payload);
      if (created) {
        setRemote((prev) => [...(prev ?? []), created]);
        setOpen(false);
        return;
      }
      setPubNote("Couldn't save online — added on this device instead.");
    }
    personal.add({ id: newId(), ...payload });
    setOpen(false);
  }

  async function removePersonal(id: string) {
    if (remote !== null) {
      if (await removeRemoteCalendarEvent(id)) {
        setRemote((prev) => (prev ?? []).filter((e) => e.id !== id));
      }
      return;
    }
    personal.remove(id);
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Everything due across your courses, plus your own events."
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-black/10 p-0.5 dark:border-white/10">
              {(["agenda", "month"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => switchView(v)}
                  aria-pressed={view === v}
                  className={cn(
                    "focus-ring rounded-md px-3 py-1.5 text-xs font-semibold capitalize",
                    view === v
                      ? "bg-brand-600 text-white"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add event
            </Button>
          </div>
        }
      />

      {pubNote && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {pubNote}
        </p>
      )}

      {view === "month" && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">{monthLabel}</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
                }
                className="focus-ring rounded-md p-1.5 text-ink-muted hover:bg-surface-subtle hover:text-ink"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
                  setSelectedDay(todayKey);
                }}
                className="focus-ring rounded-md px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-surface-subtle hover:text-ink"
              >
                Today
              </button>
              <button
                onClick={() =>
                  setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
                }
                className="focus-ring rounded-md p-1.5 text-ink-muted hover:bg-surface-subtle hover:text-ink"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="grid grid-cols-7 border-b border-black/5 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthCells.map((d) => {
                const key = dayKey(d);
                const inMonth = d.getMonth() === cursor.getMonth();
                const list = eventsByDay.get(key) ?? [];
                const isToday = key === todayKey;
                const isSelected = key === selectedDay;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(isSelected ? null : key)}
                    className={cn(
                      "focus-ring flex min-h-[76px] flex-col items-stretch gap-1 border-b border-r border-black/5 p-1.5 text-left align-top last:border-r-0 dark:border-white/5 sm:min-h-[92px]",
                      !inMonth && "bg-surface-subtle/50 opacity-60",
                      isSelected && "bg-brand-50 dark:bg-brand-500/10",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                        isToday ? "bg-brand-600 text-white" : "text-ink-muted",
                      )}
                    >
                      {d.getDate()}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      {list.slice(0, 3).map(({ e }) => {
                        const course = courses.find((c) => c.id === e.courseId);
                        return (
                          <span
                            key={e.id}
                            className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: course?.color ?? "#8b94a3" }}
                            title={e.title}
                          >
                            {e.title}
                          </span>
                        );
                      })}
                      {list.length > 3 && (
                        <span className="px-1 text-[10px] text-ink-faint">
                          +{list.length - 3} more
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDay && (
            <section className="mt-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <CalendarClock className="h-4 w-4 text-brand-600" />
                {new Date(selectedDay + "T00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              {(eventsByDay.get(selectedDay) ?? []).length === 0 ? (
                <div className="card flex items-center justify-between p-4 text-sm text-ink-muted">
                  Nothing on this day.
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDraft({ ...emptyDraft, at: `${selectedDay}T09:00` });
                      setOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" /> Add event
                  </Button>
                </div>
              ) : (
                <div className="card divide-y divide-black/5">
                  {(eventsByDay.get(selectedDay) ?? []).map(({ e, local, location }) => {
                    const course = courses.find((c) => c.id === e.courseId);
                    return (
                      <div key={e.id} className="flex items-center gap-3 p-3.5">
                        <span
                          className="h-10 w-1.5 rounded-full"
                          style={{ backgroundColor: course?.color ?? "#8b94a3" }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink">{e.title}</p>
                          <p className="text-xs text-ink-faint">
                            {course?.code ?? "Personal"} · {formatDateTime(e.at)}
                            {location && ` · ${location}`}
                          </p>
                        </div>
                        <Badge tone={typeTone[e.type]}>
                          {e.type.replace("_", " ")}
                        </Badge>
                        {local && (
                          <button
                            onClick={() => openEdit(e)}
                            className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink"
                            aria-label="Edit event"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <div className={cn("space-y-6", view !== "agenda" && "hidden")}>
        {Object.entries(grouped).map(([day, list]) => (
          <section key={day}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarClock className="h-4 w-4 text-brand-600" />
              {day}
            </h2>
            <div className="card divide-y divide-black/5">
              {list.map(({ e, local, location }) => {
                const course = courses.find((c) => c.id === e.courseId);
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 p-3.5 hover:bg-surface-subtle"
                  >
                    <span
                      className="h-10 w-1.5 rounded-full"
                      style={{ backgroundColor: course?.color ?? "#8b94a3" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{e.title}</p>
                      <p className="text-xs text-ink-faint">
                        {course?.code ?? "Personal"} · {formatDateTime(e.at)}
                        {location && ` · ${location}`}
                      </p>
                    </div>
                    <Badge tone={typeTone[e.type]}>
                      {e.type.replace("_", " ")}
                    </Badge>
                    {local && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(e)}
                          className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink"
                          aria-label="Edit event"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => removePersonal(e.id)}
                          className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Delete event"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={draft.id ? "Edit event" : "Add an event"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!draft.title.trim() || !draft.at}>
              {draft.id ? "Save changes" : "Add event"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title *">
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Study group · Library"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="When *">
              <Input
                type="datetime-local"
                value={draft.at}
                onChange={(e) => setDraft({ ...draft, at: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <Select
                value={draft.type}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    type: e.target.value as CalendarEvent["type"],
                  })
                }
              >
                <option value="event">Event</option>
                <option value="office_hours">Office hours</option>
                <option value="assignment">Assignment</option>
                <option value="quiz">Quiz</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
