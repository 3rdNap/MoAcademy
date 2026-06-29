"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
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

  const grouped = useMemo(() => {
    const all = [
      ...seedEvents.map((e) => ({ e, local: false })),
      ...personal.items.map((e) => ({ e, local: true })),
    ].sort((a, b) => +new Date(a.e.at) - +new Date(b.e.at));

    return all.reduce<Record<string, typeof all>>((acc, row) => {
      const day = new Date(row.e.at).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      (acc[day] ??= []).push(row);
      return acc;
    }, {});
  }, [seedEvents, personal.items]);

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
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add event
          </Button>
        }
      />

      <div className="space-y-6">
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
