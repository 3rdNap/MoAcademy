"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookMarked,
  ExternalLink,
  ImagePlus,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { fetchRemoteEnrolledSubjects } from "@/lib/billing/registration-db";
import { subjects } from "@/lib/billing/subjects";
import {
  addTextbook,
  fetchTextbooks,
  getSignedInUserId,
  removeTextbook,
  updateTextbook,
  uploadTextbookFile,
  type Textbook,
  type TextbookInput,
} from "@/lib/textbooks-db";

const subjectName = (code: string) =>
  subjects.find((s) => s.code === code)?.name ?? code;

function gradientFor(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++)
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 70% 45%))`;
}

type Draft = TextbookInput & { id?: string };

const emptyDraft: Draft = {
  subjectCode: subjects[0].code,
  title: "",
  author: "",
  edition: "",
  isbn: "",
  description: "",
  required: false,
  coverUrl: undefined,
  resourceUrl: undefined,
  filePath: undefined,
};

export function TextbooksBoard() {
  const { role, hydrated } = useRole();
  const manage = hydrated && canTeach(role);

  const [books, setBooks] = useState<Textbook[] | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  // Enrolled subject codes scope the student view; null means unscoped
  // (signed out / offline / teaching account) — those see everything.
  const [enrolledCodes, setEnrolledCodes] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchTextbooks().then((t) => alive && setBooks(t));
    getSignedInUserId().then((id) => alive && setSignedIn(Boolean(id)));
    fetchRemoteEnrolledSubjects().then((names) => {
      if (!alive || names === null) return;
      const codes = subjects
        .filter((s) => names.includes(s.name))
        .map((s) => s.code);
      setEnrolledCodes(codes);
    });
    return () => {
      alive = false;
    };
  }, []);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [note, setNote] = useState("");

  // Teaching accounts see every textbook; a student sees only those for the
  // subjects the academy enrolled them in. When scoping is unavailable we
  // leave the (empty for signed-out) list unfiltered.
  const visible = useMemo(() => {
    const all = books ?? [];
    if (manage || enrolledCodes === null) return all;
    const set = new Set(enrolledCodes);
    return all.filter((t) => set.has(t.subjectCode));
  }, [books, manage, enrolledCodes]);

  const grouped = useMemo(() => {
    const map = new Map<string, Textbook[]>();
    for (const t of visible) {
      if (!map.has(t.subjectCode)) map.set(t.subjectCode, []);
      map.get(t.subjectCode)!.push(t);
    }
    // Required first, then recommended; each already title-sorted from the query.
    for (const list of map.values())
      list.sort((a, b) => Number(b.required) - Number(a.required));
    return [...map.entries()].sort((a, b) =>
      subjectName(a[0]).localeCompare(subjectName(b[0])),
    );
  }, [visible]);

  function openCreate() {
    setDraft(emptyDraft);
    setNote("");
    setOpen(true);
  }
  function openEdit(t: Textbook) {
    setDraft({ ...t });
    setNote("");
    setOpen(true);
  }

  async function onCover(file?: File) {
    if (!file) return;
    setNote("Uploading cover…");
    const url = await uploadTextbookFile(file, "cover");
    if (url) {
      setDraft((d) => ({ ...d, coverUrl: url }));
      setNote(`Uploaded ${file.name}`);
    } else {
      setNote("Couldn't upload the cover — paste an image URL instead.");
    }
  }

  async function onPdf(file?: File) {
    if (!file) return;
    setNote("Uploading PDF…");
    const url = await uploadTextbookFile(file, "pdf");
    if (url) {
      setDraft((d) => ({ ...d, filePath: url }));
      setNote(`Uploaded ${file.name}`);
    } else {
      setNote("Couldn't upload the PDF — paste a resource link instead.");
    }
  }

  async function save() {
    if (!draft.title.trim()) return;
    const payload: TextbookInput = {
      subjectCode: draft.subjectCode,
      title: draft.title.trim(),
      author: draft.author.trim(),
      edition: draft.edition.trim(),
      isbn: draft.isbn.trim(),
      description: draft.description.trim(),
      required: draft.required,
      coverUrl: draft.coverUrl,
      resourceUrl: draft.resourceUrl?.trim() || undefined,
      filePath: draft.filePath,
    };

    if (draft.id) {
      const id = draft.id;
      const prev = books;
      setBooks((list) =>
        (list ?? []).map((t) => (t.id === id ? { ...t, ...payload } : t)),
      );
      if (await updateTextbook(id, payload)) {
        setOpen(false);
      } else {
        setBooks(prev);
        setNote(
          "Couldn't save — you can only manage textbooks for subjects you teach.",
        );
      }
      return;
    }

    const created = await addTextbook(payload);
    if (created) {
      setBooks((list) => [created, ...(list ?? [])]);
      setOpen(false);
    } else {
      setNote(
        "Couldn't add — you can only add textbooks for subjects you teach.",
      );
    }
  }

  async function onDelete(id: string) {
    const prev = books;
    setBooks((list) => (list ?? []).filter((t) => t.id !== id));
    if (!(await removeTextbook(id))) {
      setBooks(prev);
      setNote(
        "Couldn't remove — you can only manage textbooks for subjects you teach.",
      );
    }
  }

  const showSignIn = hydrated && !signedIn && (books === null || visible.length === 0);

  return (
    <>
      <PageHeader
        title="Textbooks"
        subtitle="Required and recommended books for your subjects."
        action={
          manage && signedIn ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add textbook
            </Button>
          ) : undefined
        }
      />

      {note && !open && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          {note}
        </p>
      )}

      {showSignIn ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <Lock className="h-6 w-6" />
          </span>
          <div>
            <p className="font-semibold text-ink">Sign in to see your textbooks</p>
            <p className="mt-1 text-sm text-ink-muted">
              Once you&apos;re signed in and enrolled, the reading lists for your
              subjects appear here.
            </p>
          </div>
        </div>
      ) : hydrated && grouped.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <BookMarked className="h-6 w-6" />
          </span>
          <p className="text-sm text-ink-muted">
            {manage
              ? "No textbooks yet — add your first one."
              : "No textbooks for your enrolled subjects yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([code, list]) => (
            <section key={code}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
                  {subjectName(code)}
                </h2>
                <Badge tone="neutral">{list.length}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {list.map((t) => {
                  const href = t.resourceUrl || t.filePath;
                  return (
                    <article
                      key={t.id}
                      className="card group flex flex-col overflow-hidden"
                    >
                      <div className="relative h-40 w-full overflow-hidden">
                        {t.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.coverUrl}
                            alt={t.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center"
                            style={{ background: gradientFor(t.title) }}
                          >
                            <BookMarked className="h-10 w-10 text-white/90" />
                          </div>
                        )}
                        {manage && (
                          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => openEdit(t)}
                              className="focus-ring flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
                              aria-label="Edit textbook"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => onDelete(t.id)}
                              className="focus-ring flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-rose-600"
                              aria-label="Delete textbook"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <div className="mb-1.5 flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-ink">{t.title}</h3>
                          <Badge tone={t.required ? "brand" : "neutral"}>
                            {t.required ? "Required" : "Recommended"}
                          </Badge>
                        </div>
                        {(t.author || t.edition) && (
                          <p className="text-sm text-ink-muted">
                            {[t.author, t.edition].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {t.isbn && (
                          <p className="mt-0.5 text-xs text-ink-faint">
                            ISBN {t.isbn}
                          </p>
                        )}
                        {t.description && (
                          <p className="mt-2 line-clamp-3 flex-1 text-sm text-ink-muted">
                            {t.description}
                          </p>
                        )}
                        <div className="mt-3">
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Get book
                            </a>
                          ) : (
                            <span className="text-xs text-ink-faint">
                              No link
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Teaching add/edit modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={draft.id ? "Edit textbook" : "Add a textbook"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!draft.title.trim()}>
              {draft.id ? "Save changes" : "Add textbook"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg"
              style={
                draft.coverUrl
                  ? undefined
                  : { background: gradientFor(draft.title || "book") }
              }
            >
              {draft.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={draft.coverUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <BookMarked className="h-6 w-6 text-white/90" />
              )}
            </div>
            <div className="flex-1">
              <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-2 text-sm text-ink-muted hover:bg-surface-subtle dark:border-white/15">
                <ImagePlus className="h-4 w-4" />
                Cover image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onCover(e.target.files?.[0])}
                />
              </label>
              <Input
                value={draft.coverUrl ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, coverUrl: e.target.value })
                }
                placeholder="…or paste an image URL"
                className="mt-2 h-8 py-1 text-xs"
              />
            </div>
          </div>

          <Field label="Subject *">
            <Select
              value={draft.subjectCode}
              onChange={(e) => setDraft({ ...draft, subjectCode: e.target.value })}
            >
              {subjects.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title *">
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Classroom Mathematics Grade 12"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Author">
              <Input
                value={draft.author}
                onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                placeholder="e.g. J. Smith"
              />
            </Field>
            <Field label="Edition">
              <Input
                value={draft.edition}
                onChange={(e) => setDraft({ ...draft, edition: e.target.value })}
                placeholder="e.g. 3rd ed."
              />
            </Field>
          </div>
          <Field label="ISBN">
            <Input
              value={draft.isbn}
              onChange={(e) => setDraft({ ...draft, isbn: e.target.value })}
              placeholder="e.g. 978-1-4315-2345-6"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={draft.required}
              onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
              className="h-4 w-4 rounded border-black/20"
            />
            Required (uncheck for recommended)
          </label>
          <Field label="Description">
            <Textarea
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder="What this book covers…"
            />
          </Field>
          <Field label="Resource link">
            <Input
              value={draft.resourceUrl ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, resourceUrl: e.target.value })
              }
              placeholder="Where to buy or read online"
            />
          </Field>
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
            {(note || draft.filePath) && (
              <p className="mt-1.5 text-xs text-ink-faint">
                {note || "PDF attached"}
              </p>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
