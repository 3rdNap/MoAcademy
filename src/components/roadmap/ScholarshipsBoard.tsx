"use client";

import { useEffect, useRef, useState } from "react";
import {
  Award,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useLocalCollection, newId } from "@/lib/roadmap/store";
import {
  addRemoteScholarship,
  fetchRemoteScholarships,
  removeRemoteScholarship,
  updateRemoteScholarship,
} from "@/lib/roadmap-db";
import { seedScholarships } from "@/lib/roadmap/seed";
import { deadlineState } from "@/lib/roadmap/deadline";
import { formatDate } from "@/lib/utils";
import type { Scholarship } from "@/lib/roadmap/types";

type Draft = Partial<Scholarship> & { id?: string; requirementsText?: string };

const emptyDraft: Draft = { name: "", provider: "", requirementsText: "" };

export function ScholarshipsBoard() {
  const { items, add, update, remove, hydrated } = useLocalCollection(
    "moacademy.roadmap.scholarships",
    seedScholarships,
  );

  // Signed-in students sync scholarships to Supabase; anonymous stays local.
  const [remote, setRemote] = useState<Scholarship[] | null>(null);
  const [pubNote, setPubNote] = useState<string | null>(null);
  const importedRef = useRef(false);
  useEffect(() => {
    let alive = true;
    fetchRemoteScholarships().then((r) => alive && setRemote(r));
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
    const seedIds = new Set(seedScholarships.map((s) => s.id));
    const own = items.filter((i) => !seedIds.has(i.id));
    if (own.length === 0) return;
    importedRef.current = true;
    (async () => {
      const created: Scholarship[] = [];
      for (const s of own) {
        const { id, ...input } = s;
        void id;
        const row = await addRemoteScholarship(input);
        if (row) created.push(row);
      }
      setRemote(created);
    })();
  }, [remote, hydrated, items]);

  const scholarships = remote ?? items;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const sorted = [...scholarships].sort((a, b) => {
    const av = a.closesAt ? +new Date(a.closesAt) : Infinity;
    const bv = b.closesAt ? +new Date(b.closesAt) : Infinity;
    return av - bv;
  });

  function openCreate() {
    setDraft(emptyDraft);
    setOpen(true);
  }

  function openEdit(s: Scholarship) {
    setDraft({ ...s, requirementsText: s.requirements.join("\n") });
    setOpen(true);
  }

  function draftToInput(d: Draft): Omit<Scholarship, "id"> {
    const requirements = (d.requirementsText ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return {
      name: d.name!.trim(),
      provider: d.provider ?? "",
      coverage: d.coverage,
      closesAt: d.closesAt,
      url: d.url,
      requirements,
      notes: d.notes,
    };
  }

  async function handleAdd(input: Omit<Scholarship, "id">) {
    if (remote !== null) {
      const temp: Scholarship = { ...input, id: newId() };
      setRemote((prev) => [temp, ...(prev ?? [])]);
      const created = await addRemoteScholarship(input);
      if (created) {
        setRemote((prev) =>
          (prev ?? []).map((s) => (s.id === temp.id ? created : s)),
        );
      } else {
        setRemote((prev) => (prev ?? []).filter((s) => s.id !== temp.id));
        setPubNote("Couldn't save to your account — please try again.");
      }
      return;
    }
    add({ ...input, id: newId() });
  }

  async function handleUpdate(id: string, input: Omit<Scholarship, "id">) {
    if (remote !== null) {
      const snapshot = remote;
      setRemote((prev) =>
        (prev ?? []).map((s) => (s.id === id ? { ...input, id } : s)),
      );
      const saved = await updateRemoteScholarship(id, input);
      if (saved) {
        setRemote((prev) => (prev ?? []).map((s) => (s.id === id ? saved : s)));
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
      setRemote((prev) => (prev ?? []).filter((s) => s.id !== id));
      if (!(await removeRemoteScholarship(id))) {
        setRemote(snapshot);
        setPubNote("Couldn't remove that — please try again.");
      }
      return;
    }
    remove(id);
  }

  function save() {
    if (!draft.name?.trim()) return;
    const input = draftToInput(draft);
    if (draft.id) {
      void handleUpdate(draft.id, input);
    } else {
      void handleAdd(input);
    }
    setOpen(false);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-muted">
          Keep every scholarship and bursary in one place — what it covers, who
          qualifies, and exactly when it closes.
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add opportunity
        </Button>
      </div>

      {pubNote && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {pubNote}
        </p>
      )}

      {hydrated && scholarships.length === 0 ? (
        <EmptyState onAdd={openCreate} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sorted.map((s) => {
            const dl = deadlineState(s.closesAt);
            return (
              <article key={s.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-ink">{s.name}</h3>
                    <p className="text-sm text-ink-muted">{s.provider}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => openEdit(s)}
                      className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-surface-subtle hover:text-ink"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleRemove(s.id)}
                      className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone={dl.tone}>{dl.label}</Badge>
                  {s.closesAt && (
                    <span className="text-xs text-ink-faint">
                      Closes {formatDate(s.closesAt)}
                    </span>
                  )}
                </div>

                {s.coverage && (
                  <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
                    <Award className="h-4 w-4 shrink-0" />
                    {s.coverage}
                  </p>
                )}

                {s.requirements.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                      Requirements
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {s.requirements.map((r, i) => (
                        <li
                          key={i}
                          className="flex gap-2 text-sm text-ink-muted"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-faint" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {s.notes && (
                  <p className="mt-3 text-xs text-ink-faint">{s.notes}</p>
                )}

                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-ring mt-4 inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    Apply / learn more <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={draft.id ? "Edit opportunity" : "Add a scholarship or bursary"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!draft.name?.trim()}>
              {draft.id ? "Save changes" : "Add opportunity"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name *">
            <Input
              value={draft.name ?? ""}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="NSFAS Bursary"
            />
          </Field>
          <Field label="Provider">
            <Input
              value={draft.provider ?? ""}
              onChange={(e) => setDraft({ ...draft, provider: e.target.value })}
              placeholder="National Student Financial Aid Scheme"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Coverage">
              <Input
                value={draft.coverage ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, coverage: e.target.value })
                }
                placeholder="Full tuition + stipend"
              />
            </Field>
            <Field label="Closes">
              <Input
                type="date"
                value={draft.closesAt ? draft.closesAt.slice(0, 10) : ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    closesAt: e.target.value
                      ? new Date(e.target.value + "T23:59:00Z").toISOString()
                      : undefined,
                  })
                }
              />
            </Field>
          </div>
          <Field label="Link">
            <Input
              value={draft.url ?? ""}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <Field label="Requirements (one per line)">
            <Textarea
              value={draft.requirementsText ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, requirementsText: e.target.value })
              }
              placeholder={"South African citizen\nHousehold income below threshold\nAccepted at a public university"}
              className="min-h-[110px]"
            />
          </Field>
          <Field label="Notes">
            <Textarea
              value={draft.notes ?? ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Anything else to remember…"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Award className="h-6 w-6" />
      </span>
      <div>
        <p className="font-semibold text-ink">No opportunities yet</p>
        <p className="mt-1 text-sm text-ink-muted">
          Add scholarships and bursaries with their closing dates and
          requirements so you never miss one.
        </p>
      </div>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4" /> Add opportunity
      </Button>
    </div>
  );
}
