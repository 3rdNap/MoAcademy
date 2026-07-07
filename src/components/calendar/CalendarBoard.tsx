"use client";

import { useEffect, useMemo, useState } from "react";
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
import { formatDateTime } from "@/lib/utils";
import type { CalendarEvent, Course } from "@/lib/types";

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

  const allEvents = useMemo(
    () => [
      ...seedEvents.map((e) => ({ e, local: false })),
      ...personal.items.map((e) => ({ e, local: true })),
    ],
    [seedEvents, personal.items],
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

  // ----- Month view state -----
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // yyyy-mm-dd

  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

  function save() {
    if (!draft.title.trim() || !draft.at) return;
    const at = new Date(draft.at).toISOString();
    if (draft.id) {
      personal.update(draft.id, { title: draft.title.trim(), at, type: draft.type });
    } else {
      personal.add({
        id: newId(),
        title: draft.title.trim(),
        at,
        type: draft.type,
      });
    }
    setOpen(false);
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
                  {(eventsByDay.get(selectedDay) ?? []).map(({ e, local }) => {
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
              {list.map(({ e, local }) => {
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
                          onClick={() => personal.remove(e.id)}
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
