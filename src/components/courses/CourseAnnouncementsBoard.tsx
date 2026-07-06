"use client";

import { useMemo, useState } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/form";
import { MoMarkIcon } from "@/components/layout/MoMarkIcon";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { useLocalCollection, newId } from "@/lib/local-store";
import { formatDateTime, initialsOf } from "@/lib/utils";
import type { Announcement, Course } from "@/lib/types";

type Draft = { id?: string; title: string; author: string; body: string };

export function CourseAnnouncementsBoard({
  course,
  seed,
}: {
  course: Course;
  seed: Announcement[];
}) {
  const { role, hydrated } = useRole();
  const teaching = hydrated && canTeach(role);

  const authored = useLocalCollection<Announcement>(
    `moacademy.authoring.announcements.${course.id}`,
    [],
  );

  const emptyDraft: Draft = { title: "", author: course.instructor, body: "" };
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  /** "Draft with Mo": generate the announcement body from the title. */
  async function draftWithMo() {
    if (!draft.title.trim() || aiBusy) return;
    setAiBusy(true);
    setAiNote(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "announcement-body",
          title: draft.title,
          course: `${course.code} ${course.name}`,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { text?: string; error?: string }
        | null;
      if (!res.ok || !data?.text) {
        setAiNote(data?.error ?? "Mo couldn't draft that right now.");
        return;
      }
      setDraft((d) => ({ ...d, body: data.text! }));
    } catch {
      setAiNote("Mo couldn't draft that right now.");
    } finally {
      setAiBusy(false);
    }
  }

  const rows = useMemo(
    () =>
      [
        ...authored.items.map((a) => ({ a, local: true })),
        ...seed.map((a) => ({ a, local: false })),
      ].sort((x, y) => +new Date(y.a.postedAt) - +new Date(x.a.postedAt)),
    [authored.items, seed],
  );

  function openCreate() {
    setDraft(emptyDraft);
    setOpen(true);
  }

  function openEdit(a: Announcement) {
    setDraft({ id: a.id, title: a.title, author: a.author, body: a.body });
    setOpen(true);
  }

  function save() {
    if (!draft.title.trim() || !draft.body.trim()) return;
    if (draft.id) {
      authored.update(draft.id, {
        title: draft.title.trim(),
        author: draft.author.trim() || course.instructor,
        body: draft.body.trim(),
      });
    } else {
      authored.add({
        id: newId(),
        courseId: course.id,
        title: draft.title.trim(),
        author: draft.author.trim() || course.instructor,
        postedAt: new Date().toISOString(),
        body: draft.body.trim(),
      });
    }
    setOpen(false);
  }

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle={`Updates from ${course.code}.`}
        action={
          teaching ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Announcement
            </Button>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <Megaphone className="h-8 w-8 text-ink-faint" />
          <p className="text-sm text-ink-muted">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map(({ a, local }) => (
            <article key={a.id} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Avatar initials={initialsOf(a.author)} color={course.color} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-ink">{a.title}</h2>
                      {local && <Badge tone="brand">Posted by you</Badge>}
                    </div>
                    <p className="text-xs text-ink-faint">
                      {a.author} · {formatDateTime(a.postedAt)}
                    </p>
                  </div>
                </div>
                {teaching && local && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => openEdit(a)}
                      className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink"
                      aria-label="Edit announcement"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => authored.remove(a.id)}
                      className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Delete announcement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
                {a.body}
              </p>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={draft.id ? "Edit announcement" : "New announcement"}
        description="Posted to everyone enrolled in this course."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={!draft.title.trim() || !draft.body.trim()}
            >
              {draft.id ? "Save changes" : "Post announcement"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title *">
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Midterm review session"
            />
          </Field>
          <Field label="Posted by">
            <Input
              value={draft.author}
              onChange={(e) => setDraft({ ...draft, author: e.target.value })}
            />
          </Field>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="block text-xs font-medium uppercase tracking-wide text-ink-faint">
                Message *
              </span>
              <button
                type="button"
                onClick={draftWithMo}
                disabled={!draft.title.trim() || aiBusy}
                title={
                  draft.title.trim()
                    ? "Let Mo draft the announcement from the title"
                    : "Give the announcement a title first"
                }
                className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
              >
                <MoMarkIcon className="h-3 w-auto" />
                {aiBusy ? "Drafting…" : "Draft with Mo"}
              </button>
            </div>
            {aiNote && <p className="mb-1 text-xs text-rose-600">{aiNote}</p>}
            <Textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="Write your announcement…"
              className="min-h-[120px]"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
