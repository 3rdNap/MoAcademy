"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { useLocalCollection, newId } from "@/lib/local-store";
import {
  addRemoteModule,
  addRemoteModuleItem,
  courseFileUrl,
  fetchRemoteModules,
  removeRemoteModule,
  removeRemoteModuleItem,
  setRemoteModulePublished,
  updateRemoteModuleItem,
  uploadCourseFile,
} from "@/lib/course-content-db";
import { getSignedInUserId } from "@/lib/study-guides-db";
import { fetchMyItemProgress, setItemComplete } from "@/lib/module-progress-db";
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

  // Per-item completion for non-remote (seed/local) items — a working toggle
  // for anonymous/demo users too. Presence in this collection = complete.
  const progress = useLocalCollection<{ id: string }>(
    `moacademy.progress.${course.id}`,
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
  // Completed item ids for the signed-in user (migration 0023) — null when
  // signed out/offline, in which case remote items fall back to `progress`.
  const [remoteProgress, setRemoteProgress] = useState<Set<string> | null>(
    null,
  );
  useEffect(() => {
    let alive = true;
    fetchRemoteModules(course.id).then((r) => alive && setRemote(r));
    getSignedInUserId().then((id) => alive && setSignedIn(Boolean(id)));
    fetchMyItemProgress().then(
      (ids) => alive && setRemoteProgress(ids ? new Set(ids) : null),
    );
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
        body: item.body,
        url: item.url,
        filePath: item.filePath,
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

  async function updateItem(
    m: CourseModule,
    source: Source,
    itemId: string,
    patch: { title?: string; body?: string; url?: string; filePath?: string },
  ) {
    if (source === "remote") {
      if (await updateRemoteModuleItem(itemId, patch)) {
        setRemote((prev) =>
          (prev ?? []).map((x) =>
            x.id === m.id
              ? {
                  ...x,
                  items: x.items.map((it) =>
                    it.id === itemId ? { ...it, ...patch } : it,
                  ),
                }
              : x,
          ),
        );
      }
      return;
    }
    authored.update(m.id, {
      items: m.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    });
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

  // Completion = explicit user action. Remote items check the server-tracked
  // set (falling back to the local store when offline/signed out); seed/local
  // items respect the local store or the seed data's static flag — whichever
  // says done. A toggle never mutates seed data, only the local store.
  function isItemComplete(item: ModuleItem, source: Source): boolean {
    if (source === "remote" && remoteProgress !== null) {
      return remoteProgress.has(item.id);
    }
    return (
      progress.items.some((p) => p.id === item.id) || Boolean(item.completed)
    );
  }

  async function toggleItemComplete(item: ModuleItem, source: Source) {
    const done = isItemComplete(item, source);
    const next = !done;

    if (source === "remote" && signedIn) {
      setRemoteProgress((prev) => {
        const s = new Set(prev ?? []);
        if (next) s.add(item.id);
        else s.delete(item.id);
        return s;
      });
      const ok = await setItemComplete(item.id, next);
      if (!ok) {
        setRemoteProgress((prev) => {
          const s = new Set(prev ?? []);
          if (next) s.delete(item.id);
          else s.add(item.id);
          return s;
        });
      }
      return;
    }

    if (next) {
      if (!progress.items.some((p) => p.id === item.id)) {
        progress.add({ id: item.id });
      }
    } else {
      progress.remove(item.id);
    }
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
            courseId={course.id}
            color={course.color}
            signedIn={signedIn}
            editable={
              teaching && (source === "local" || (source === "remote" && signedIn))
            }
            shared={source === "remote"}
            teaching={teaching}
            isItemComplete={(item) => isItemComplete(item, source)}
            onToggleItem={(item) => toggleItemComplete(item, source)}
            onTogglePublished={() => togglePublished(m, source)}
            onDeleteModule={() => deleteModule(m, source)}
            onAddItem={(item) => addItem(m, source, item)}
            onUpdateItem={(itemId, patch) => updateItem(m, source, itemId, patch)}
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

// Types whose content lives in the item itself (a page body, an external/video
// URL, an uploaded file) and so open a content editor on add. The rest
// (assignment/quiz/discussion) are pointers to course tabs — title only.
const contentTypes: ModuleItemType[] = ["page", "link", "video", "file"];

function ModuleSection({
  module,
  courseId,
  color,
  signedIn,
  editable,
  shared,
  teaching,
  isItemComplete,
  onToggleItem,
  onTogglePublished,
  onDeleteModule,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}: {
  module: CourseModule;
  courseId: string;
  color: string;
  /** File uploads need a signed-in account; hide the file type otherwise. */
  signedIn: boolean;
  editable: boolean;
  /** True when this module lives in the shared database. */
  shared?: boolean;
  /** Teaching accounts see static status icons, not the toggle. */
  teaching: boolean;
  isItemComplete: (item: ModuleItem) => boolean;
  onToggleItem: (item: ModuleItem) => void;
  onTogglePublished: () => void;
  onDeleteModule: () => void;
  onAddItem: (item: ModuleItem) => void;
  onUpdateItem: (
    itemId: string,
    patch: { title?: string; body?: string; url?: string; filePath?: string },
  ) => void;
  onDeleteItem: (itemId: string) => void;
}) {
  const router = useRouter();
  const [itemTitle, setItemTitle] = useState("");
  const [itemType, setItemType] = useState<ModuleItemType>("page");
  // Content editor: `null` closed; `{ type }` = new item; `{ item }` = edit.
  const [editor, setEditor] = useState<
    { type: ModuleItemType; item?: ModuleItem } | null
  >(null);
  const [viewing, setViewing] = useState<ModuleItem | null>(null);

  const availableTypes = itemTypes.filter((t) => t !== "file" || signedIn);

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!itemTitle.trim()) return;
    // Content-bearing types collect their content in a modal; the rest add
    // immediately since they just point at a course tab.
    if (contentTypes.includes(itemType)) {
      setEditor({ type: itemType });
      return;
    }
    onAddItem({ id: newId(), title: itemTitle.trim(), type: itemType });
    setItemTitle("");
  }

  function saveEditor(patch: {
    title: string;
    body?: string;
    url?: string;
    filePath?: string;
  }) {
    if (editor?.item) {
      onUpdateItem(editor.item.id, patch);
    } else if (editor) {
      onAddItem({ id: newId(), type: editor.type, ...patch });
      setItemTitle("");
    }
    setEditor(null);
  }

  // A row is interactive only when it has somewhere to go: content types need
  // their content, course-tab pointers always resolve.
  function itemTarget(it: ModuleItem): boolean {
    switch (it.type) {
      case "page":
        return Boolean(it.body?.trim());
      case "link":
      case "video":
        return Boolean(it.url);
      case "file":
        return Boolean(it.filePath);
      default:
        return true;
    }
  }

  function openItem(it: ModuleItem) {
    switch (it.type) {
      case "page":
        setViewing(it);
        return;
      case "link":
      case "video":
        if (it.url) window.open(it.url, "_blank", "noopener,noreferrer");
        return;
      case "file": {
        const url = it.filePath ? courseFileUrl(it.filePath) : null;
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      case "assignment":
      case "quiz":
        router.push(`/courses/${courseId}/assignments`);
        return;
      case "discussion":
        router.push(`/courses/${courseId}/discussions`);
        return;
    }
  }

  const doneCount = module.items.filter(isItemComplete).length;

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between gap-2 bg-surface-subtle px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold text-ink">
          {!module.published && <Lock className="h-4 w-4 text-ink-faint" />}
          {module.title}
        </h2>
        <div className="flex items-center gap-2">
          {!teaching && module.items.length > 0 && (
            <span className="text-xs text-ink-faint">
              {doneCount}/{module.items.length} done
            </span>
          )}
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
          const done = isItemComplete(it);
          const clickable = itemTarget(it);
          return (
            <li
              key={it.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-subtle"
            >
              <span className="shrink-0">
                {teaching ? (
                  done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Icon className="h-5 w-5 text-ink-faint" />
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggleItem(it)}
                    aria-label={`Mark "${it.title}" ${done ? "incomplete" : "done"}`}
                    aria-pressed={done}
                    className="focus-ring rounded-full"
                  >
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Icon className="h-5 w-5 text-ink-faint hover:text-ink-muted" />
                    )}
                  </button>
                )}
              </span>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => openItem(it)}
                  className="focus-ring group min-w-0 flex-1 rounded text-left"
                >
                  <p
                    className={
                      done
                        ? "text-sm text-ink-muted group-hover:text-ink group-hover:underline"
                        : "text-sm font-medium text-ink group-hover:underline"
                    }
                  >
                    {it.title}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {itemLabel[it.type]}
                    {it.durationMin ? ` · ${it.durationMin} min` : ""}
                    {it.dueAt ? ` · Due ${formatDateTime(it.dueAt)}` : ""}
                  </p>
                </button>
              ) : (
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      done ? "text-sm text-ink-muted" : "text-sm font-medium text-ink"
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
              )}
              {it.dueAt && !done && (
                <span className="hidden items-center gap-1 text-xs text-ink-faint sm:flex">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDateTime(it.dueAt)}
                </span>
              )}
              {/* Editing rich content only makes sense for shared (remote) rows. */}
              {editable && shared && contentTypes.includes(it.type) && (
                <button
                  onClick={() => setEditor({ type: it.type, item: it })}
                  className="focus-ring rounded p-1 text-ink-faint hover:text-ink"
                  aria-label="Edit item content"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
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
            {availableTypes.map((t) => (
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

      {editor && (
        <ItemContentModal
          type={editor.type}
          editing={Boolean(editor.item)}
          canUpload={signedIn}
          initial={
            editor.item
              ? {
                  title: editor.item.title,
                  body: editor.item.body,
                  url: editor.item.url,
                  filePath: editor.item.filePath,
                }
              : { title: itemTitle.trim() }
          }
          onClose={() => setEditor(null)}
          onSave={saveEditor}
        />
      )}

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.title ?? ""}
      >
        {viewing?.body?.trim() ? (
          <p className="whitespace-pre-wrap text-sm text-ink">{viewing.body}</p>
        ) : (
          <p className="text-sm text-ink-faint">This page has no content yet.</p>
        )}
      </Modal>
    </section>
  );
}

// Author a content-bearing item (page body / link · video URL / uploaded file).
// Used for both adding a new item and editing an existing shared one. Mounted
// only while open, so its draft state starts fresh each time.
function ItemContentModal({
  type,
  editing,
  canUpload,
  initial,
  onClose,
  onSave,
}: {
  type: ModuleItemType;
  editing: boolean;
  canUpload: boolean;
  initial: { title: string; body?: string; url?: string; filePath?: string };
  onClose: () => void;
  onSave: (patch: {
    title: string;
    body?: string;
    url?: string;
    filePath?: string;
  }) => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body ?? "");
  const [url, setUrl] = useState(initial.url ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [existingPath] = useState(initial.filePath);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const urlType = type === "link" || type === "video";

  async function save() {
    if (!title.trim()) return;

    let filePath = existingPath;
    if (type === "file") {
      if (file) {
        setUploading(true);
        const res = await uploadCourseFile(file);
        setUploading(false);
        if (!res) {
          setNote("Couldn't upload the file — try again.");
          return;
        }
        filePath = res.path;
      }
      if (!filePath) {
        setNote("Choose a file to upload.");
        return;
      }
    }

    onSave({
      title: title.trim(),
      body: type === "page" ? body : undefined,
      url: urlType ? url.trim() || undefined : undefined,
      filePath: type === "file" ? filePath : undefined,
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${editing ? "Edit" : "New"} ${itemLabel[type].toLowerCase()}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!title.trim() || uploading}>
            {uploading ? "Uploading…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title *">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Reading · Chapter 3"
          />
        </Field>

        {type === "page" && (
          <Field label="Page content">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the page content students will read…"
              className="min-h-[160px]"
            />
          </Field>
        )}

        {urlType && (
          <Field label={type === "video" ? "Video URL" : "Link URL"}>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>
        )}

        {type === "file" && (
          <Field label="File">
            {existingPath && !file && (
              <p className="mb-2 text-xs text-ink-muted">
                A file is already attached. Choose a new one to replace it.
              </p>
            )}
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-sm file:text-ink"
            />
            {!canUpload && (
              <p className="mt-2 text-xs text-ink-faint">
                Sign in with a teaching account to upload files.
              </p>
            )}
          </Field>
        )}

        {note && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            {note}
          </p>
        )}
      </div>
    </Modal>
  );
}
