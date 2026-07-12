"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  ExternalLink,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useLocalCollection, newId } from "@/lib/roadmap/store";
import {
  addRemoteApplication,
  fetchRemoteApplications,
  removeRemoteApplication,
  updateRemoteApplication,
} from "@/lib/roadmap-db";
import { seedApplications } from "@/lib/roadmap/seed";
import { deadlineState } from "@/lib/roadmap/deadline";
import { formatDate } from "@/lib/utils";
import type {
  ApplicationEntry,
  ApplicationStatus,
} from "@/lib/roadmap/types";

const statusMeta: Record<
  ApplicationStatus,
  { label: string; tone: "neutral" | "info" | "brand" | "success" | "warning" | "danger" }
> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  submitted: { label: "Submitted", tone: "brand" },
  accepted: { label: "Accepted", tone: "success" },
  waitlisted: { label: "Waitlisted", tone: "warning" },
  rejected: { label: "Rejected", tone: "danger" },
};

// Cap inline-uploaded prospectus files so we stay within localStorage limits.
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

type Draft = Partial<ApplicationEntry> & { id?: string };

const emptyDraft: Draft = { institution: "", status: "not_started" };

export function ApplicationsBoard() {
  const { items, add, update, remove, hydrated } = useLocalCollection(
    "moacademy.roadmap.applications",
    seedApplications,
  );

  // Signed-in students sync applications to Supabase; anonymous stays local.
  const [remote, setRemote] = useState<ApplicationEntry[] | null>(null);
  const [pubNote, setPubNote] = useState<string | null>(null);
  const importedRef = useRef(false);
  useEffect(() => {
    let alive = true;
    fetchRemoteApplications().then((r) => alive && setRemote(r));
    return () => {
      alive = false;
    };
  }, []);

  // One-time import: a fresh remote account inherits what's on this device.
  useEffect(() => {
    if (importedRef.current) return;
    if (remote === null || remote.length > 0 || !hydrated) return;
    // Never import the bundled demo seed, which useLocalCollection
    // persists even for untouched visitors.
    const seedIds = new Set(seedApplications.map((s) => s.id));
    const own = items.filter((i) => !seedIds.has(i.id));
    if (own.length === 0) return;
    importedRef.current = true;
    (async () => {
      const created: ApplicationEntry[] = [];
      for (const a of own) {
        const { id, ...input } = a;
        void id;
        const row = await addRemoteApplication(input);
        if (row) created.push(row);
      }
      setRemote(created);
    })();
  }, [remote, hydrated, items]);

  const applications = remote ?? items;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [uploadNote, setUploadNote] = useState("");

  const sorted = [...applications].sort((a, b) => {
    const av = a.closesAt ? +new Date(a.closesAt) : Infinity;
    const bv = b.closesAt ? +new Date(b.closesAt) : Infinity;
    return av - bv;
  });

  function openCreate() {
    setDraft(emptyDraft);
    setUploadNote("");
    setOpen(true);
  }

  function openEdit(a: ApplicationEntry) {
    setDraft(a);
    setUploadNote("");
    setOpen(true);
  }

  function draftToInput(d: Draft): Omit<ApplicationEntry, "id"> {
    return {
      institution: d.institution!.trim(),
      program: d.program,
      opensAt: d.opensAt,
      closesAt: d.closesAt,
      applyUrl: d.applyUrl,
      prospectusUrl: d.prospectusUrl,
      prospectusFileName: d.prospectusFileName,
      prospectusData: d.prospectusData,
      status: d.status ?? "not_started",
      notes: d.notes,
    };
  }

  async function handleAdd(input: Omit<ApplicationEntry, "id">) {
    if (remote !== null) {
      const temp: ApplicationEntry = { ...input, id: newId() };
      setRemote((prev) => [temp, ...(prev ?? [])]);
      const created = await addRemoteApplication(input);
      if (created) {
        setRemote((prev) =>
          (prev ?? []).map((a) => (a.id === temp.id ? created : a)),
        );
      } else {
        setRemote((prev) => (prev ?? []).filter((a) => a.id !== temp.id));
        setPubNote("Couldn't save to your account — please try again.");
      }
      return;
    }
    add({ ...input, id: newId() });
  }

  async function handleUpdate(id: string, input: Omit<ApplicationEntry, "id">) {
    if (remote !== null) {
      const snapshot = remote;
      setRemote((prev) =>
        (prev ?? []).map((a) => (a.id === id ? { ...input, id } : a)),
      );
      const saved = await updateRemoteApplication(id, input);
      if (saved) {
        setRemote((prev) => (prev ?? []).map((a) => (a.id === id ? saved : a)));
      } else {
        setRemote(snapshot);
        setPubNote("Couldn't save your change — please try again.");
      }
      return;
    }
    update(id, input);
  }

  async function handleRemove(id: string) {
    if (remote !== null) {
      const snapshot = remote;
      setRemote((prev) => (prev ?? []).filter((a) => a.id !== id));
      if (!(await removeRemoteApplication(id))) {
        setRemote(snapshot);
        setPubNote("Couldn't remove that — please try again.");
      }
      return;
    }
    remove(id);
  }

  function save() {
    if (!draft.institution?.trim()) return;
    const input = draftToInput(draft);
    if (draft.id) {
      void handleUpdate(draft.id, input);
    } else {
      void handleAdd(input);
    }
    setOpen(false);
  }

  function onFile(file?: File) {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadNote(
        "That file is over 3 MB — paste a link instead for larger prospectuses.",
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((d) => ({
        ...d,
        prospectusFileName: file.name,
        prospectusData: reader.result as string,
      }));
      setUploadNote(`Attached ${file.name}`);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-muted">
          Track each institution&apos;s application window, jump straight to the
          online portal, and keep the prospectus handy.
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add application
        </Button>
      </div>

      {pubNote && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {pubNote}
        </p>
      )}

      {hydrated && applications.length === 0 ? (
        <EmptyState onAdd={openCreate} />
      ) : (
        <div className="space-y-3">
          {sorted.map((a) => {
            const dl = deadlineState(a.closesAt);
            const st = statusMeta[a.status];
            const prospectusHref = a.prospectusData || a.prospectusUrl;
            return (
              <article key={a.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-ink">{a.institution}</h3>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <Badge tone={dl.tone}>{dl.label}</Badge>
                    </div>
                    {a.program && (
                      <p className="text-sm text-ink-muted">{a.program}</p>
                    )}
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {a.opensAt ? `Opens ${formatDate(a.opensAt)}` : "Opens —"}
                      {" · "}
                      {a.closesAt ? `Closes ${formatDate(a.closesAt)}` : "Closes —"}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {a.applyUrl && (
                      <a
                        href={a.applyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        Apply <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {prospectusHref && (
                      <a
                        href={prospectusHref}
                        target="_blank"
                        rel="noreferrer"
                        download={a.prospectusFileName}
                        className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/10 px-3 text-xs font-semibold text-ink hover:bg-surface-subtle"
                      >
                        <FileText className="h-3.5 w-3.5" /> Prospectus
                      </a>
                    )}
                    <button
                      onClick={() => openEdit(a)}
                      className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-surface-subtle hover:text-ink"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleRemove(a.id)}
                      className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
        title={draft.id ? "Edit application" : "Add an application"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!draft.institution?.trim()}>
              {draft.id ? "Save changes" : "Add application"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Institution *">
            <Input
              value={draft.institution ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, institution: e.target.value })
              }
              placeholder="University of Cape Town"
            />
          </Field>
          <Field label="Programme">
            <Input
              value={draft.program ?? ""}
              onChange={(e) => setDraft({ ...draft, program: e.target.value })}
              placeholder="BSc Computer Science"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opens">
              <Input
                type="date"
                value={toDateInput(draft.opensAt)}
                onChange={(e) =>
                  setDraft({ ...draft, opensAt: fromDateInput(e.target.value) })
                }
              />
            </Field>
            <Field label="Closes">
              <Input
                type="date"
                value={toDateInput(draft.closesAt)}
                onChange={(e) =>
                  setDraft({ ...draft, closesAt: fromDateInput(e.target.value) })
                }
              />
            </Field>
          </div>
          <Field label="Status">
            <Select
              value={draft.status ?? "not_started"}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  status: e.target.value as ApplicationStatus,
                })
              }
            >
              {Object.entries(statusMeta).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Online application link">
            <Input
              value={draft.applyUrl ?? ""}
              onChange={(e) => setDraft({ ...draft, applyUrl: e.target.value })}
              placeholder="https://apply.university.ac.za"
            />
          </Field>
          <Field label="Prospectus link">
            <Input
              value={draft.prospectusUrl ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, prospectusUrl: e.target.value })
              }
              placeholder="https://…/prospectus.pdf"
            />
          </Field>
          <div>
            <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-2 text-sm text-ink-muted hover:bg-surface-subtle">
              <Upload className="h-4 w-4" />
              Or upload a prospectus file
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,image/*"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
            {(uploadNote || draft.prospectusFileName) && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-faint">
                <Paperclip className="h-3 w-3" />
                {uploadNote || draft.prospectusFileName}
              </p>
            )}
          </div>
          <Field label="Notes">
            <Textarea
              value={draft.notes ?? ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Documents needed, application fee, reference contacts…"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function toDateInput(iso?: string) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}
function fromDateInput(value: string) {
  return value ? new Date(value + "T23:59:00Z").toISOString() : undefined;
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <FileText className="h-6 w-6" />
      </span>
      <div>
        <p className="font-semibold text-ink">No applications tracked yet</p>
        <p className="mt-1 text-sm text-ink-muted">
          Add an institution to track its opening and closing dates, portal link
          and prospectus.
        </p>
      </div>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4" /> Add application
      </Button>
    </div>
  );
}
