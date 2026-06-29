"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Lock, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { useLocalCollection, newId } from "@/lib/local-store";
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

  const rows = useMemo(
    () => [
      ...seed.map((m) => ({ m, local: false })),
      ...authored.items.map((m) => ({ m, local: true })),
    ],
    [seed, authored.items],
  );

  function createModule() {
    if (!title.trim()) return;
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

      <div className="space-y-4">
        {rows.map(({ m, local }) => (
          <ModuleSection
            key={m.id}
            module={m}
            color={course.color}
            editable={teaching && local}
            onTogglePublished={() =>
              authored.update(m.id, { published: !m.published })
            }
            onDeleteModule={() => authored.remove(m.id)}
            onAddItem={(item) =>
              authored.update(m.id, { items: [...m.items, item] })
            }
            onDeleteItem={(itemId) =>
              authored.update(m.id, {
                items: m.items.filter((it) => it.id !== itemId),
              })
            }
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
  onTogglePublished,
  onDeleteModule,
  onAddItem,
  onDeleteItem,
}: {
  module: CourseModule;
  color: string;
  editable: boolean;
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
