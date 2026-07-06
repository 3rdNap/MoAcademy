"use client";

import { useEffect, useMemo, useState } from "react";
import { Paperclip, Pencil, Plus, Send, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { MoMarkIcon } from "@/components/layout/MoMarkIcon";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { useLocalCollection, newId } from "@/lib/local-store";
import {
  addRemoteAssignment,
  fetchRemoteAssignments,
  removeRemoteAssignment,
  updateRemoteAssignment,
} from "@/lib/course-content-db";
import { getSignedInUserId } from "@/lib/study-guides-db";
import { itemIcon } from "@/lib/itemMeta";
import { formatDateTime, relativeTime } from "@/lib/utils";
import type { Assignment, Course, SubmissionStatus } from "@/lib/types";

interface Submission {
  id: string; // assignment id
  body: string;
  fileName?: string;
  submittedAt: string;
}

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

  const submissions = useLocalCollection<Submission>(
    `moacademy.submissions.${course.id}`,
    [],
  );

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [submitFor, setSubmitFor] = useState<Assignment | null>(null);
  const [subBody, setSubBody] = useState("");
  const [subFile, setSubFile] = useState<string | undefined>();
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [pubNote, setPubNote] = useState<string | null>(null);

  // Shared assignments (Supabase): published by signed-in teaching accounts,
  // visible to every student on every device.
  const [remote, setRemote] = useState<Assignment[] | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchRemoteAssignments(course.id).then((r) => alive && setRemote(r));
    getSignedInUserId().then((id) => alive && setSignedIn(Boolean(id)));
    return () => {
      alive = false;
    };
  }, [course.id]);

  /** "Draft with Mo": generate the student-facing description server-side. */
  async function draftWithMo() {
    if (!draft.title.trim() || aiBusy) return;
    setAiBusy(true);
    setAiNote(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "assignment-description",
          title: draft.title,
          type: draft.type,
          course: `${course.code} ${course.name}`,
          points: draft.points,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { text?: string; error?: string }
        | null;
      if (!res.ok || !data?.text) {
        setAiNote(data?.error ?? "Mo couldn't draft that right now.");
        return;
      }
      setDraft((d) => ({ ...d, description: data.text! }));
    } catch {
      setAiNote("Mo couldn't draft that right now.");
    } finally {
      setAiBusy(false);
    }
  }

  const submissionFor = (aid: string) =>
    submissions.items.find((s) => s.id === aid);

  function effectiveStatus(a: Assignment): SubmissionStatus {
    if (a.status === "graded") return "graded";
    return submissionFor(a.id) ? "submitted" : a.status;
  }

  function openSubmit(a: Assignment) {
    const existing = submissionFor(a.id);
    setSubmitFor(a);
    setSubBody(existing?.body ?? "");
    setSubFile(existing?.fileName);
  }

  function submitWork() {
    if (!submitFor) return;
    const existing = submissionFor(submitFor.id);
    const record: Submission = {
      id: submitFor.id,
      body: subBody.trim(),
      fileName: subFile,
      submittedAt: new Date().toISOString(),
    };
    if (existing) submissions.update(submitFor.id, record);
    else submissions.add(record);
    setSubmitFor(null);
    setSubBody("");
    setSubFile(undefined);
  }

  type Source = "local" | "remote" | "seed";
  const rows = useMemo(() => {
    // The server-provided seed already merges published rows (data layer), so
    // dedupe against the client's own fetch of the shared table.
    const remoteIds = new Set((remote ?? []).map((a) => a.id));
    const combined = [
      ...seed
        .filter((a) => !remoteIds.has(a.id))
        .map((a) => ({ a, source: "seed" as Source })),
      ...(remote ?? []).map((a) => ({ a, source: "remote" as Source })),
      ...authored.items.map((a) => ({ a, source: "local" as Source })),
    ];
    return combined.sort((x, y) => +new Date(x.a.dueAt) - +new Date(y.a.dueAt));
  }, [seed, remote, authored.items]);

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

  async function save() {
    if (!draft.title.trim()) return;
    const dueAt = draft.dueAt
      ? new Date(draft.dueAt + "T23:59:00Z").toISOString()
      : new Date().toISOString();
    const input = {
      title: draft.title.trim(),
      type: draft.type,
      dueAt,
      points: draft.points,
      description: draft.description,
    };

    // Publish to the shared table when signed in; a refused write (not a
    // teaching account) falls back to this device with a note.
    const isRemoteRow = Boolean(draft.id && remote?.some((a) => a.id === draft.id));
    if (remote !== null && signedIn) {
      if (isRemoteRow) {
        if (await updateRemoteAssignment(draft.id!, input)) {
          setRemote((prev) =>
            (prev ?? []).map((a) => (a.id === draft.id ? { ...a, ...input } : a)),
          );
          setOpen(false);
          return;
        }
      } else if (!draft.id) {
        const created = await addRemoteAssignment(course.id, input);
        if (created) {
          setRemote((prev) => [...(prev ?? []), created]);
          setOpen(false);
          return;
        }
      }
      setPubNote(
        "Couldn't publish to all students (teaching account required) — saved on this device instead.",
      );
    }
    if (isRemoteRow) return; // don't shadow a published assignment locally

    if (draft.id) {
      authored.update(draft.id, input);
    } else {
      const assignment: Assignment = {
        id: newId(),
        courseId: course.id,
        status: "not_started",
        ...input,
      };
      authored.add(assignment);
    }
    setOpen(false);
  }

  async function removeRow(a: Assignment, source: Source) {
    if (source === "remote") {
      if (await removeRemoteAssignment(a.id)) {
        setRemote((prev) => (prev ?? []).filter((x) => x.id !== a.id));
      }
      return;
    }
    authored.remove(a.id);
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

      {pubNote && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {pubNote}
        </p>
      )}

      <div className="card divide-y divide-black/5">
        {rows.map(({ a, source }) => {
          const Icon = itemIcon[a.type];
          const status = effectiveStatus(a);
          const badge = statusBadge[status];
          const sub = submissionFor(a.id);
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
                  {source === "local" && <Badge tone="brand">Added by you</Badge>}
                  {source === "remote" && <Badge tone="success">Published</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">{a.description}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  Due {formatDateTime(a.dueAt)} · {a.points} pts
                  {sub && (
                    <span className="text-emerald-600">
                      {" "}
                      · Submitted {relativeTime(sub.submittedAt)}
                      {sub.fileName ? ` · ${sub.fileName}` : ""}
                    </span>
                  )}
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
                {!teaching && a.status !== "graded" && (
                  <Button
                    size="sm"
                    variant={sub ? "outline" : "primary"}
                    onClick={() => openSubmit(a)}
                  >
                    {sub ? "Resubmit" : "Submit"}
                  </Button>
                )}
                {teaching &&
                  (source === "local" || (source === "remote" && signedIn)) && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(a)}
                      className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink"
                      aria-label="Edit assignment"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeRow(a, source)}
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
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="block text-xs font-medium uppercase tracking-wide text-ink-faint">
                Description
              </span>
              <button
                type="button"
                onClick={draftWithMo}
                disabled={!draft.title.trim() || aiBusy}
                title={
                  draft.title.trim()
                    ? "Let Mo draft the description from the title"
                    : "Give the assignment a title first"
                }
                className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
              >
                <MoMarkIcon className="h-3 w-auto" />
                {aiBusy ? "Drafting…" : "Draft with Mo"}
              </button>
            </div>
            {aiNote && <p className="mb-1 text-xs text-rose-600">{aiNote}</p>}
            <Textarea
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder="Instructions for students…"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={submitFor !== null}
        onClose={() => setSubmitFor(null)}
        title={`Submit · ${submitFor?.title ?? ""}`}
        description={
          submitFor
            ? `Due ${formatDateTime(submitFor.dueAt)} · ${submitFor.points} pts`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setSubmitFor(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitWork}
              disabled={!subBody.trim() && !subFile}
            >
              <Send className="h-4 w-4" /> Turn in
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Your response">
            <Textarea
              value={subBody}
              onChange={(e) => setSubBody(e.target.value)}
              placeholder="Type your submission, paste a link, or attach a file below…"
              className="min-h-[120px]"
            />
          </Field>
          <div>
            <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-2 text-sm text-ink-muted hover:bg-surface-subtle">
              <Upload className="h-4 w-4" />
              Attach a file
              <input
                type="file"
                className="hidden"
                onChange={(e) => setSubFile(e.target.files?.[0]?.name)}
              />
            </label>
            {subFile && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-faint">
                <Paperclip className="h-3 w-3" />
                {subFile}
              </p>
            )}
          </div>
          <p className="text-xs text-ink-faint">
            Demo submission — your work is saved in this browser and the status
            updates to “Submitted”.
          </p>
        </div>
      </Modal>
    </>
  );
}
