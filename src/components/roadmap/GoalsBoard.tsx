"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Compass,
  Pencil,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useLocalCollection, newId } from "@/lib/roadmap/store";
import { seedTargets } from "@/lib/roadmap/seed";
import type {
  Priority,
  RequirementItem,
  TargetInstitution,
} from "@/lib/roadmap/types";

const priorityMeta: Record<
  Priority,
  { label: string; tone: "danger" | "brand" | "success" }
> = {
  reach: { label: "Reach", tone: "danger" },
  target: { label: "Target", tone: "brand" },
  safety: { label: "Safety", tone: "success" },
};

type Draft = Omit<TargetInstitution, "id" | "requirements"> & { id?: string };

const emptyDraft: Draft = {
  institution: "",
  program: "",
  location: "",
  priority: "target",
  minAps: undefined,
  targetAps: undefined,
  currentAps: undefined,
  notes: "",
};

export function GoalsBoard() {
  const { items, add, update, remove, hydrated } = useLocalCollection(
    "moacademy.roadmap.targets",
    seedTargets,
  );
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  function openCreate() {
    setDraft(emptyDraft);
    setOpen(true);
  }

  function openEdit(t: TargetInstitution) {
    const { requirements, ...rest } = t;
    void requirements;
    setDraft(rest);
    setOpen(true);
  }

  function save() {
    if (!draft.institution.trim()) return;
    if (draft.id) {
      update(draft.id, draft);
    } else {
      add({ ...draft, id: newId(), requirements: [] });
    }
    setOpen(false);
  }

  function addRequirement(target: TargetInstitution, label: string) {
    if (!label.trim()) return;
    const req: RequirementItem = { id: newId(), label: label.trim(), met: false };
    update(target.id, { requirements: [...target.requirements, req] });
  }

  function patchRequirement(
    target: TargetInstitution,
    reqId: string,
    patch: Partial<RequirementItem>,
  ) {
    update(target.id, {
      requirements: target.requirements.map((r) =>
        r.id === reqId ? { ...r, ...patch } : r,
      ),
    });
  }

  function removeRequirement(target: TargetInstitution, reqId: string) {
    update(target.id, {
      requirements: target.requirements.filter((r) => r.id !== reqId),
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-muted">
          Add the institutions and programmes you&apos;re aiming for. Capture not
          just the published minimums but the marks that make you{" "}
          <span className="font-medium text-ink">competitive enough to be safe</span>{" "}
          — then tick off each requirement as you meet it.
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add target
        </Button>
      </div>

      {hydrated && items.length === 0 ? (
        <EmptyState onAdd={openCreate} />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((t) => (
            <TargetCard
              key={t.id}
              target={t}
              onEdit={() => openEdit(t)}
              onDelete={() => remove(t.id)}
              onAddRequirement={(label) => addRequirement(t, label)}
              onToggleRequirement={(reqId, met) =>
                patchRequirement(t, reqId, { met })
              }
              onRemoveRequirement={(reqId) => removeRequirement(t, reqId)}
            />
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={draft.id ? "Edit target" : "Add a target institution"}
        description="You can edit or remove this any time as things change."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!draft.institution.trim()}>
              {draft.id ? "Save changes" : "Add target"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Institution *">
            <Input
              value={draft.institution}
              onChange={(e) =>
                setDraft({ ...draft, institution: e.target.value })
              }
              placeholder="e.g. University of Cape Town"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Programme">
              <Input
                value={draft.program}
                onChange={(e) => setDraft({ ...draft, program: e.target.value })}
                placeholder="BSc Computer Science"
              />
            </Field>
            <Field label="Location">
              <Input
                value={draft.location ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, location: e.target.value })
                }
                placeholder="Cape Town"
              />
            </Field>
          </div>
          <Field label="Priority">
            <Select
              value={draft.priority}
              onChange={(e) =>
                setDraft({ ...draft, priority: e.target.value as Priority })
              }
            >
              <option value="reach">Reach — competitive, aim high</option>
              <option value="target">Target — a realistic match</option>
              <option value="safety">Safety — very likely to get in</option>
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Min APS">
              <Input
                type="number"
                value={draft.minAps ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    minAps: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="42"
              />
            </Field>
            <Field label="Target APS">
              <Input
                type="number"
                value={draft.targetAps ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    targetAps: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                placeholder="48"
              />
            </Field>
            <Field label="Your APS">
              <Input
                type="number"
                value={draft.currentAps ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    currentAps: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                placeholder="40"
              />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea
              value={draft.notes ?? ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Anything to remember — weighting, portfolios, interviews…"
            />
          </Field>
          <p className="text-xs text-ink-faint">
            Add the specific subject requirements on the card after saving.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function TargetCard({
  target,
  onEdit,
  onDelete,
  onAddRequirement,
  onToggleRequirement,
  onRemoveRequirement,
}: {
  target: TargetInstitution;
  onEdit: () => void;
  onDelete: () => void;
  onAddRequirement: (label: string) => void;
  onToggleRequirement: (reqId: string, met: boolean) => void;
  onRemoveRequirement: (reqId: string) => void;
}) {
  const [newReq, setNewReq] = useState("");
  const meta = priorityMeta[target.priority];
  const met = target.requirements.filter((r) => r.met).length;
  const total = target.requirements.length;
  const pct = total ? Math.round((met / total) * 100) : 0;
  const apsGap =
    target.targetAps != null && target.currentAps != null
      ? target.targetAps - target.currentAps
      : null;

  return (
    <article className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {target.location && (
              <span className="text-xs text-ink-faint">{target.location}</span>
            )}
          </div>
          <h3 className="mt-1.5 font-semibold text-ink">{target.institution}</h3>
          <p className="text-sm text-ink-muted">{target.program}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={onEdit}
            className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-surface-subtle hover:text-ink"
            aria-label="Edit target"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"
            aria-label="Delete target"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* APS strip */}
      {(target.minAps != null ||
        target.targetAps != null ||
        target.currentAps != null) && (
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-surface-subtle p-3 text-center">
          <ApsStat label="Minimum" value={target.minAps} />
          <ApsStat label="Target" value={target.targetAps} accent />
          <ApsStat label="You" value={target.currentAps} />
          {apsGap != null && (
            <p className="col-span-3 mt-1 text-xs text-ink-muted">
              {apsGap > 0 ? (
                <>
                  <Target className="mr-1 inline h-3.5 w-3.5 text-amber-500" />
                  {apsGap} point{apsGap === 1 ? "" : "s"} to reach your safe target
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-500" />
                  You&apos;re at or above your target — keep it up!
                </>
              )}
            </p>
          )}
        </div>
      )}

      {/* Requirements */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-ink-muted">
          <span className="font-medium uppercase tracking-wide text-ink-faint">
            Requirements
          </span>
          <span>
            {met}/{total} met
          </span>
        </div>
        <ProgressBar value={pct} />
        <ul className="mt-3 space-y-1.5">
          {target.requirements.map((r) => (
            <li key={r.id} className="group flex items-start gap-2">
              <button
                onClick={() => onToggleRequirement(r.id, !r.met)}
                className="focus-ring mt-0.5 shrink-0 rounded-full"
                aria-label={r.met ? "Mark as not met" : "Mark as met"}
              >
                {r.met ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Circle className="h-5 w-5 text-ink-faint" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={
                    r.met ? "text-sm text-ink-faint" : "text-sm text-ink"
                  }
                >
                  {r.label}
                </p>
                {(r.minimum || r.recommended) && (
                  <p className="text-xs text-ink-faint">
                    {r.minimum && <>min {r.minimum}</>}
                    {r.minimum && r.recommended && " · "}
                    {r.recommended && (
                      <span className="text-brand-600">
                        safe {r.recommended}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <button
                onClick={() => onRemoveRequirement(r.id)}
                className="focus-ring rounded p-1 text-ink-faint opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
                aria-label="Remove requirement"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>

        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onAddRequirement(newReq);
            setNewReq("");
          }}
        >
          <Input
            value={newReq}
            onChange={(e) => setNewReq(e.target.value)}
            placeholder="Add a requirement, e.g. Mathematics 75%"
            className="h-9 py-1.5 text-sm"
          />
          <Button type="submit" size="sm" variant="outline">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {target.notes && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {target.notes}
        </p>
      )}
    </article>
  );
}

function ApsStat({
  label,
  value,
  accent,
}: {
  label: string;
  value?: number;
  accent?: boolean;
}) {
  return (
    <div>
      <p
        className={
          accent
            ? "text-lg font-bold text-brand-600"
            : "text-lg font-bold text-ink"
        }
      >
        {value ?? "—"}
      </p>
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">
        {label}
      </p>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Compass className="h-6 w-6" />
      </span>
      <div>
        <p className="font-semibold text-ink">Start your roadmap</p>
        <p className="mt-1 text-sm text-ink-muted">
          Add the first institution you&apos;re aiming for and the requirements to
          get in.
        </p>
      </div>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4" /> Add target
      </Button>
    </div>
  );
}
