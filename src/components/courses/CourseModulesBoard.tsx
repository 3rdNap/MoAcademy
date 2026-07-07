"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Lock, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { useLocalCollection, newId } from "@/lib/local-store";
import {
  addRemoteModule,
  addRemoteModuleItem,
  fetchRemoteModules,
  removeRemoteModule,
  removeRemoteModuleItem,
  setRemoteModulePublished,
} from "@/lib/course-content-db";
import { getSignedInUserId } from "@/lib/study-guides-db";
import { itemIcon, itemLabel } from "@/lib/itemMeta";
import { formatDateTime } from "@/lib/utils";
import type { Course, CourseModule, ModuleItem, ModuleItemType } from "@/lib/types";

const itemTypes: ModuleItemType[] = [
  "page",
  "assignment",
  "quiz",
  "discussion",
  "video",
  "file",
  "link",
];

export function CourseModulesBoard({
  course,
  seed,
}: {
  course: Course;
  seed: CourseModule[];
}) {
  const { role, hydrated } = useRole();
  const teaching = hydrated && canTeach(role);

  const authored = useLocalCollection<CourseModule>(
    `moacademy.authoring.modules.${course.id}`,
    [],
  );

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [published, setPublished] = useState(true);
  const [pubNote, setPubNote] = useState<string | null>(null);

  // Shared modules (Supabase): published by signed-in teaching accounts,
  // visible to every student on every device.
  const [remote, setRemote] = useState<CourseModule[] | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchRemoteModules(course.id).then((r) => alive && setRemote(r));
    getSignedInUserId().then((id) => alive && setSignedIn(Boolean(id)));
    return () => {
      alive = false;
    };
  }, [course.id]);

  type Source = "local" | "remote" | "seed";
  const rows = useMemo(() => {
    // The server-provided seed already merges published rows (data layer), so
    // dedupe against the client's own fetch of the shared table.
    const remoteIds = new Set((remote ?? []).map((m) => m.id));
    return [
      ...seed
        .filter((m) => !remoteIds.has(m.id))
        .map((m) => ({ m, source: "seed" as Source })),
      ...(remote ?? []).map((m) => ({ m, source: "remote" as Source })),
      ...authored.items.map((m) => ({ m, source: "local" as Source })),
    ];
  }, [seed, remote, authored.items]);

  async function createModule() {
    if (!title.trim()) return;

    // Publish to the shared table when signed in; a refused write (not a
    // teaching account) falls back to this device with a note.
    if (remote !== null && signedIn) {
      const created = await addRemoteModule(course.id, title.trim(), published);
      if (created) {
        setRemote((prev) => [...(prev ?? []), created]);
        setTitle("");
        setPublished(true);
        setOpen(false);
        return;
      }
      setPubNote(
        "Couldn't publish to all students (teaching account required) — saved on this device instead.",
      );
    }

    const mod: CourseModule = {
      id: newId(),
      courseId: course.id,
      title: title.trim(),
      published,
      items: [],
    };
    authored.add(mod);
    setTitle("");
    setPublished(true);
    setOpen(false);
  }

  /* -------- handlers that route to the shared table or local store ------- */

  async function togglePublished(m: CourseModule, source: Source) {
    if (source === "remote") {
      if (await setRemoteModulePublished(m.id, !m.published)) {
        setRemote((prev) =>
          (prev ?? []).map((x) =>
            x.id === m.id ? { ...x, published: !m.published } : x,
          ),
        );
      }
      return;
    }
    authored.update(m.id, { published: !m.published });
  }

  async function deleteModule(m: CourseModule, source: Source) {
    if (source === "remote") {
      if (await removeRemoteModule(m.id)) {
        setRemote((prev) => (prev ?? []).filter((x) => x.id !== m.id));
      }
      return;
    }
    authored.remove(m.id);
  }

  async function addItem(m: CourseModule, source: Source, item: ModuleItem) {
    if (source === "remote") {
      const created = await addRemoteModuleItem(m.id, {
        title: item.title,
        type: item.type,
        position: m.items.length,
      });
      if (created) {
        setRemote((prev) =>
          (prev ?? []).map((x) =>
            x.id === m.id ? { ...x, items: [...x.items, created] } : x,
          ),
        );
      }
      return;
    }
    authored.update(m.id, { items: [...m.items, item] });
  }

  async function deleteItem(m: CourseModule, source: Source, itemId: string) {
    if (source === "remote") {
      if (await removeRemoteModuleItem(itemId)) {
        setRemote((prev) =>
          (prev ?? []).map((x) =>
            x.id === m.id
              ? { ...x, items: x.items.filter((it) => it.id !== itemId) }
              : x,
          ),
        );
      }
      return;
    }
    authored.update(m.id, { items: m.items.filter((it) => it.id !== itemId) });
  }

  return (
    <>
      <PageHeader
        title="Modules"
        subtitle="Work through each module in order."
        action={
          teaching ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Module
            </Button>
          ) : undefined
        }
      />

      {pubNote && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {pubNote}
        </p>
      )}

      <div className="space-y-4">
        {rows.map(({ m, source }) => (
          <ModuleSection
            key={m.id}
            module={m}
            color={course.color}
            editable={
              teaching && (source === "local" || (source === "remote" && signedIn))
            }
            shared={source === "remote"}
            onTogglePublished={() => togglePublished(m, source)}
            onDeleteModule={() => deleteModule(m, source)}
            onAddItem={(item) => addItem(m, source, item)}
            onDeleteItem={(itemId) => deleteItem(m, source, itemId)}
          />
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New module"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createModule} disabled={!title.trim()}>
              Create module
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Module title *">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Module 4 · Recursion"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="h-4 w-4 rounded border-black/20"
            />
            Publish immediately (visible to students)
          </label>
        </div>
      </Modal>
    </>
  );
}

function ModuleSection({
  module,
  color,
  editable,
  shared,
  onTogglePublished,
  onDeleteModule,
  onAddItem,
  onDeleteItem,
}: {
  module: CourseModule;
  color: string;
  editable: boolean;
  /** True when this module lives in the shared database. */
  shared?: boolean;
  onTogglePublished: () => void;
  onDeleteModule: () => void;
  onAddItem: (item: ModuleItem) => void;
  onDeleteItem: (itemId: string) => void;
}) {
  const [itemTitle, setItemTitle] = useState("");
  const [itemType, setItemType] = useState<ModuleItemType>("page");

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!itemTitle.trim()) return;
    onAddItem({ id: newId(), title: itemTitle.trim(), type: itemType });
    setItemTitle("");
  }

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between gap-2 bg-surface-subtle px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold text-ink">
          {!module.published && <Lock className="h-4 w-4 text-ink-faint" />}
          {module.title}
        </h2>
        <div className="flex items-center gap-2">
          {shared && <Badge tone="info">All students</Badge>}
          {module.published ? (
            <Badge tone="success">Published</Badge>
          ) : (
            <Badge tone="neutral">Locked</Badge>
          )}
          {editable && (
            <>
              <button
                onClick={onTogglePublished}
                className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
              >
                {module.published ? "Unpublish" : "Publish"}
              </button>
              <button
                onClick={onDeleteModule}
                className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"
                aria-label="Delete module"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </header>

      <ul className="divide-y divide-black/5">
        {module.items.map((it) => {
          const Icon = itemIcon[it.type];
          return (
            <li
              key={it.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-subtle"
            >
              <span className="shrink-0">
                {it.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Icon className="h-5 w-5 text-ink-faint" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={
                    it.completed
                      ? "text-sm text-ink-muted"
                      : "text-sm font-medium text-ink"
                  }
                >
                  {it.title}
                </p>
                <p className="text-xs text-ink-faint">
                  {itemLabel[it.type]}
                  {it.durationMin ? ` · ${it.durationMin} min` : ""}
                  {it.dueAt ? ` · Due ${formatDateTime(it.dueAt)}` : ""}
                </p>
              </div>
              {it.dueAt && !it.completed && (
                <span className="hidden items-center gap-1 text-xs text-ink-faint sm:flex">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDateTime(it.dueAt)}
                </span>
              )}
              {editable && (
                <button
                  onClick={() => onDeleteItem(it.id)}
                  className="focus-ring rounded p-1 text-ink-faint hover:text-rose-600"
                  aria-label="Remove item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          );
        })}
        {module.items.length === 0 && (
          <li className="px-4 py-3 text-sm text-ink-faint">No items yet.</li>
        )}
      </ul>

      {editable && (
        <form
          onSubmit={addItem}
          className="flex flex-wrap gap-2 border-t border-black/5 bg-surface-subtle/60 px-4 py-3"
        >
          <Input
            value={itemTitle}
            onChange={(e) => setItemTitle(e.target.value)}
            placeholder="Add an item…"
            className="h-9 min-w-[10rem] flex-1 py-1.5 text-sm"
          />
          <Select
            value={itemType}
            onChange={(e) => setItemType(e.target.value as ModuleItemType)}
            className="h-9 w-32 py-1.5 text-sm"
          >
            {itemTypes.map((t) => (
              <option key={t} value={t}>
                {itemLabel[t]}
              </option>
            ))}
          </Select>
          <Button type="submit" size="sm" variant="outline" style={{ borderColor: color }}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </form>
      )}
    </section>
  );
}
