"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { useLocalCollection, newId } from "@/lib/local-store";
import { itemIcon } from "@/lib/itemMeta";
import { formatDateTime } from "@/lib/utils";
import type { Assignment, Course, SubmissionStatus } from "@/lib/types";

const statusBadge: Record<
  SubmissionStatus,
  { tone: "neutral" | "brand" | "success" | "warning" | "danger" | "info"; label: string }
> = {
  not_started: { tone: "neutral", label: "Not started" },
  in_progress: { tone: "info", label: "In progress" },
  submitted: { tone: "brand", label: "Submitted" },
  graded: { tone: "success", label: "Graded" },
  late: { tone: "warning", label: "Late" },
  missing: { tone: "danger", label: "Missing" },
};

type AuthorType = "assignment" | "quiz" | "discussion";
type Draft = {
  id?: string;
  title: string;
  type: AuthorType;
  dueAt: string; // yyyy-mm-dd
  points: number;
  description: string;
};

const emptyDraft: Draft = {
  title: "",
  type: "assignment",
  dueAt: "",
  points: 100,
  description: "",
};

export function CourseAssignmentsBoard({
  course,
  seed,
}: {
  course: Course;
  seed: Assignment[];
}) {
  const { role, hydrated } = useRole();
  const teaching = hydrated && canTeach(role);

  const authored = useLocalCollection<Assignment>(
    `moacademy.authoring.assignments.${course.id}`,
    [],
  );

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const rows = useMemo(() => {
    const combined = [
      ...seed.map((a) => ({ a, local: false })),
      ...authored.items.map((a) => ({ a, local: true })),
    ];
    return combined.sort((x, y) => +new Date(x.a.dueAt) - +new Date(y.a.dueAt));
  }, [seed, authored.items]);

  const totalPoints = rows.reduce((n, r) => n + r.a.points, 0);

  function openCreate() {
    setDraft(emptyDraft);
    setOpen(true);
  }

  function openEdit(a: Assignment) {
    setDraft({
      id: a.id,
      title: a.title,
      type: a.type as AuthorType,
      dueAt: a.dueAt ? a.dueAt.slice(0, 10) : "",
      points: a.points,
      description: a.description,
    });
    setOpen(true);
  }

  function save() {
    if (!draft.title.trim()) return;
    const dueAt = draft.dueAt
      ? new Date(draft.dueAt + "T23:59:00Z").toISOString()
      : new Date().toISOString();
    if (draft.id) {
      authored.update(draft.id, {
        title: draft.title.trim(),
        type: draft.type,
        dueAt,
        points: draft.points,
        description: draft.description,
      });
    } else {
      const assignment: Assignment = {
        id: newId(),
        courseId: course.id,
        title: draft.title.trim(),
        type: draft.type,
        dueAt,
        points: draft.points,
        status: "not_started",
        description: draft.description,
      };
      authored.add(assignment);
    }
    setOpen(false);
  }

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle={`${rows.length} assignments · ${totalPoints} points total`}
        action={
          teaching ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Assignment
            </Button>
          ) : undefined
        }
      />

      <div className="card divide-y divide-black/5">
        {rows.map(({ a, local }) => {
          const Icon = itemIcon[a.type];
          const badge = statusBadge[a.status];
          return (
            <div
              key={a.id}
              className="flex items-start gap-3 p-4 hover:bg-surface-subtle"
            >
              <span
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: course.color }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-ink">{a.title}</h3>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                  {local && <Badge tone="brand">Added by you</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">{a.description}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  Due {formatDateTime(a.dueAt)} · {a.points} pts
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {a.status === "graded" && a.score != null ? (
                  <p className="text-lg font-bold text-ink">
                    {a.score}
                    <span className="text-sm font-normal text-ink-faint">
                      /{a.points}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-ink-faint">—/{a.points}</p>
                )}
                {teaching && local && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(a)}
                      className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink"
                      aria-label="Edit assignment"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => authored.remove(a.id)}
                      className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Delete assignment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={draft.id ? "Edit assignment" : "New assignment"}
        description="Visible to students enrolled in this course."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!draft.title.trim()}>
              {draft.id ? "Save changes" : "Create assignment"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title *">
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Project 2 · Data structures"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select
                value={draft.type}
                onChange={(e) =>
                  setDraft({ ...draft, type: e.target.value as AuthorType })
                }
              >
                <option value="assignment">Assignment</option>
                <option value="quiz">Quiz</option>
                <option value="discussion">Discussion</option>
              </Select>
            </Field>
            <Field label="Points">
              <Input
                type="number"
                value={draft.points}
                onChange={(e) =>
                  setDraft({ ...draft, points: Number(e.target.value) || 0 })
                }
              />
            </Field>
          </div>
          <Field label="Due date">
            <Input
              type="date"
              value={draft.dueAt}
              onChange={(e) => setDraft({ ...draft, dueAt: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder="Instructions for students…"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
