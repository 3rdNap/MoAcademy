"use client";

import { useState } from "react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { Widget } from "@/components/ui/Widget";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import {
  addCourseMeeting,
  removeCourseMeeting,
  type CourseMeeting,
} from "@/lib/course-content-db";
import type { Course } from "@/lib/types";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type Draft = {
  weekday: number;
  startTime: string;
  endTime: string;
  location: string;
};

const emptyDraft: Draft = {
  weekday: 1,
  startTime: "09:00",
  endTime: "10:00",
  location: "",
};

function slotLabel(m: CourseMeeting): string {
  return `${WEEKDAYS[m.weekday]} · ${m.startTime}–${m.endTime}${
    m.location ? ` · ${m.location}` : ""
  }`;
}

/** Weekly timetable for a course (migration 0030). Everyone sees the read-only
 *  list; teaching accounts get an edit surface to add/remove slots. */
export function CourseScheduleWidget({
  course,
  meetings: initial,
}: {
  course: Course;
  meetings: CourseMeeting[];
}) {
  const { role, hydrated } = useRole();
  const editable = hydrated && canTeach(role);

  const [meetings, setMeetings] = useState(initial);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pubNote, setPubNote] = useState<string | null>(null);

  function sorted(list: CourseMeeting[]): CourseMeeting[] {
    return [...list].sort(
      (a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime),
    );
  }

  async function addSlot() {
    if (!draft.startTime || !draft.endTime) return;
    const created = await addCourseMeeting(course.id, draft);
    if (created) {
      setMeetings((prev) => sorted([...prev, created]));
      setDraft(emptyDraft);
      setPubNote(null);
      return;
    }
    setPubNote("Couldn't save that slot — try again in a moment.");
  }

  async function removeSlot(id: string) {
    if (await removeCourseMeeting(id)) {
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      setPubNote(null);
      return;
    }
    setPubNote("Couldn't remove that slot — try again in a moment.");
  }

  return (
    <>
      <Widget
        title="Class schedule"
        icon={<CalendarClock className="h-4 w-4 text-brand-600" />}
        action={
          editable ? (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit schedule
            </Button>
          ) : undefined
        }
      >
        {pubNote && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            {pubNote}
          </p>
        )}
        {meetings.length === 0 ? (
          <p className="text-sm text-ink-faint">No scheduled sessions yet.</p>
        ) : (
          <ul className="space-y-2">
            {meetings.map((m) => (
              <li key={m.id} className="text-sm text-ink">
                {slotLabel(m)}
              </li>
            ))}
          </ul>
        )}
      </Widget>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit class schedule"
        description={`Weekly meeting times for ${course.code}.`}
        footer={
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="space-y-4">
          {meetings.length === 0 ? (
            <p className="text-sm text-ink-faint">No scheduled sessions yet.</p>
          ) : (
            <ul className="space-y-2">
              {meetings.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
                >
                  <span className="text-ink">{slotLabel(m)}</span>
                  <button
                    onClick={() => removeSlot(m.id)}
                    className="focus-ring rounded-md p-1 text-ink-faint hover:text-rose-600"
                    aria-label="Delete slot"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Weekday">
              <Select
                value={draft.weekday}
                onChange={(e) =>
                  setDraft({ ...draft, weekday: Number(e.target.value) })
                }
              >
                {WEEKDAYS.map((w, i) => (
                  <option key={w} value={i}>
                    {w}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Location">
              <Input
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                placeholder="Room 204"
              />
            </Field>
            <Field label="Start *">
              <Input
                type="time"
                value={draft.startTime}
                onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
              />
            </Field>
            <Field label="End *">
              <Input
                type="time"
                value={draft.endTime}
                onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
              />
            </Field>
          </div>
          <Button
            onClick={addSlot}
            disabled={!draft.startTime || !draft.endTime}
          >
            <Plus className="h-4 w-4" /> Add slot
          </Button>
        </div>
      </Modal>
    </>
  );
}
