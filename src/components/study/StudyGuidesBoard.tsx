"use client";

import { useState } from "react";
import {
  Download,
  FileText,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useLocalCollection, newId } from "@/lib/local-store";
import { seedGuides, type StudyGuide } from "@/lib/study-guides";
import { formatDate } from "@/lib/utils";

// Keep uploads within the browser storage budget. Larger PDFs should be linked.
const MAX_PDF = 3 * 1024 * 1024;
const MAX_THUMB = 1.5 * 1024 * 1024;

type Draft = {
  id?: string;
  title: string;
  subject: string;
  description: string;
  pdfUrl?: string;
  pdfFileName?: string;
  pdfData?: string;
  thumbUrl?: string;
  thumbData?: string;
};

const emptyDraft: Draft = { title: "", subject: "", description: "" };

/** Deterministic gradient for guides without a thumbnail. */
function gradientFor(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 70% 45%))`;
}

export function StudyGuidesBoard() {
  const { items, add, update, remove, hydrated } = useLocalCollection<StudyGuide>(
    "moacademy.studyGuides",
    seedGuides,
  );

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [note, setNote] = useState("");

  function openCreate() {
    setDraft(emptyDraft);
    setNote("");
    setOpen(true);
  }

  function openEdit(g: StudyGuide) {
    setDraft({ ...g });
    setNote("");
    setOpen(true);
  }

  function onPdf(file?: File) {
    if (!file) return;
    if (file.size > MAX_PDF) {
      setNote("That PDF is over 3 MB — paste a link instead for larger files.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setDraft((d) => ({
        ...d,
        pdfFileName: file.name,
        pdfData: reader.result as string,
        pdfUrl: undefined,
      }));
    reader.readAsDataURL(file);
    setNote(`Attached ${file.name}`);
  }

  function onThumb(file?: File) {
    if (!file) return;
    if (file.size > MAX_THUMB) {
      setNote("That image is over 1.5 MB — try a smaller thumbnail.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setDraft((d) => ({
        ...d,
        thumbData: reader.result as string,
        thumbUrl: undefined,
      }));
    reader.readAsDataURL(file);
  }

  function save() {
    if (!draft.title.trim()) return;
    const payload = {
      title: draft.title.trim(),
      subject: draft.subject.trim(),
      description: draft.description.trim(),
      pdfUrl: draft.pdfUrl,
      pdfFileName: draft.pdfFileName,
      pdfData: draft.pdfData,
      thumbUrl: draft.thumbUrl,
      thumbData: draft.thumbData,
    };
    if (draft.id) {
      update(draft.id, payload);
    } else {
      add({ ...payload, id: newId(), createdAt: new Date().toISOString() });
    }
    setOpen(false);
  }

  const draftThumb = draft.thumbData || draft.thumbUrl;

  return (
    <>
      <PageHeader
        title="Study Guides"
        subtitle="Upload and browse PDF study guides, each with its own thumbnail."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add guide
          </Button>
        }
      />

      {hydrated && items.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <FileText className="h-6 w-6" />
          </span>
          <div>
            <p className="font-semibold text-ink">No study guides yet</p>
            <p className="mt-1 text-sm text-ink-muted">
              Add your first guide with a PDF and a thumbnail.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add guide
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((g) => {
            const thumb = g.thumbData || g.thumbUrl;
            const href = g.pdfData || g.pdfUrl;
            return (
              <article
                key={g.id}
                className="card group flex flex-col overflow-hidden"
              >
                {/* Thumbnail */}
                <div className="relative h-36 w-full overflow-hidden">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={g.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ background: gradientFor(g.title) }}
                    >
                      <FileText className="h-10 w-10 text-white/90" />
                    </div>
                  )}
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(g)}
                      className="focus-ring flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
                      aria-label="Edit guide"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(g.id)}
                      className="focus-ring flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-rose-600"
                      aria-label="Delete guide"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-4">
                  {g.subject && (
                    <Badge tone="brand" className="mb-2 self-start">
                      {g.subject}
                    </Badge>
                  )}
                  <h3 className="font-semibold text-ink">{g.title}</h3>
                  <p className="mt-1 line-clamp-3 flex-1 text-sm text-ink-muted">
                    {g.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-ink-faint">
                      {formatDate(g.createdAt)}
                    </span>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        download={g.pdfFileName}
                        className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        <Download className="h-3.5 w-3.5" /> Open PDF
                      </a>
                    ) : (
                      <span className="text-xs text-ink-faint">No file</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={draft.id ? "Edit study guide" : "Add a study guide"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!draft.title.trim()}>
              {draft.id ? "Save changes" : "Add guide"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Thumbnail picker */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg"
              style={draftThumb ? undefined : { background: gradientFor(draft.title || "guide") }}
            >
              {draftThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draftThumb} alt="" className="h-full w-full object-cover" />
              ) : (
                <FileText className="h-7 w-7 text-white/90" />
              )}
            </div>
            <div>
              <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-2 text-sm text-ink-muted hover:bg-surface-subtle dark:border-white/15">
                <ImagePlus className="h-4 w-4" />
                Thumbnail image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onThumb(e.target.files?.[0])}
                />
              </label>
              <Input
                value={draft.thumbUrl ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, thumbUrl: e.target.value, thumbData: undefined })
                }
                placeholder="…or paste an image URL"
                className="mt-2 h-8 py-1 text-xs"
              />
            </div>
          </div>

          <Field label="Title *">
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Trigonometry Formula Sheet"
            />
          </Field>
          <Field label="Subject">
            <Input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              placeholder="Mathematics"
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="What this guide covers…"
            />
          </Field>

          {/* PDF picker */}
          <div>
            <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-2 text-sm text-ink-muted hover:bg-surface-subtle dark:border-white/15">
              <Upload className="h-4 w-4" />
              Upload PDF
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => onPdf(e.target.files?.[0])}
              />
            </label>
            <Input
              value={draft.pdfUrl ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  pdfUrl: e.target.value,
                  pdfData: undefined,
                  pdfFileName: undefined,
                })
              }
              placeholder="…or paste a PDF link"
              className="mt-2 h-8 py-1 text-xs"
            />
            {(note || draft.pdfFileName) && (
              <p className="mt-1.5 text-xs text-ink-faint">
                {note || draft.pdfFileName}
              </p>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
