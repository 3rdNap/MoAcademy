"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/form";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchCourseRoster, type RosterStudent } from "@/lib/gradebook-db";
import {
  addMember,
  createGroup,
  fetchCourseGroups,
  removeGroup,
  removeMember,
  renameGroup,
  type CourseGroup,
} from "@/lib/groups-db";
import { initialsOf } from "@/lib/utils";
import type { Course } from "@/lib/types";

export function CourseGroupsBoard({ course }: { course: Course }) {
  const { role, hydrated } = useRole();
  const teaching = hydrated && canTeach(role);

  if (!hydrated) {
    return (
      <>
        <PageHeader title="Groups" subtitle={`Groups in ${course.code}.`} />
        <div className="card p-6 text-sm text-ink-muted">Loading…</div>
      </>
    );
  }
  if (!teaching) return <StudentGroups course={course} />;
  return <InstructorGroups course={course} />;
}

/* --------------------------- Instructor view ---------------------------- */

function InstructorGroups({ course }: { course: Course }) {
  const [roster, setRoster] = useState<RosterStudent[] | null | undefined>(
    undefined,
  );
  const [groups, setGroups] = useState<CourseGroup[] | undefined>(undefined);
  const [note, setNote] = useState<string | null>(null);

  // New-group + auto-split controls.
  const [newName, setNewName] = useState("");
  const [splitN, setSplitN] = useState(2);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchCourseRoster(course.id).then((r) => alive && setRoster(r));
    fetchCourseGroups(course.id).then((g) => alive && setGroups(g ?? []));
    return () => {
      alive = false;
    };
  }, [course.id]);

  const byId = useMemo(() => {
    const m = new Map<string, RosterStudent>();
    for (const s of roster ?? []) m.set(s.id, s);
    return m;
  }, [roster]);

  // Which group names each student belongs to (for the "also in …" hint).
  const groupsOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const g of groups ?? [])
      for (const id of g.memberIds) {
        const arr = m.get(id) ?? [];
        arr.push(g.name);
        m.set(id, arr);
      }
    return m;
  }, [groups]);

  const unassigned = useMemo(() => {
    const placed = new Set((groups ?? []).flatMap((g) => g.memberIds));
    return (roster ?? []).filter((s) => !placed.has(s.id));
  }, [groups, roster]);

  // Real mode requires a signed-in teaching account for this subject.
  if (roster === undefined || groups === undefined) {
    return (
      <>
        <PageHeader title="Groups" subtitle={`Groups in ${course.code}.`} />
        <div className="card p-6 text-sm text-ink-muted">Loading groups…</div>
      </>
    );
  }
  if (roster === null) {
    return (
      <>
        <PageHeader title="Groups" subtitle={`Groups in ${course.code}.`} />
        <div className="card flex flex-col items-start gap-2 p-6">
          <p className="font-semibold text-ink">Sign in to manage groups</p>
          <p className="text-sm text-ink-muted">
            Groups need a signed-in teaching account for this subject. Once
            you&apos;re signed in as this course&apos;s instructor, your enrolled
            roster appears here to partition into groups.
          </p>
        </div>
      </>
    );
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setNote(null);
    const created = await createGroup(course.id, name);
    if (!created) {
      setNote("Couldn't create the group — a teaching account is required.");
      return;
    }
    setGroups((prev) => [...(prev ?? []), created].sort(byName));
    setNewName("");
  }

  async function handleRename(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const previous = groups!;
    setGroups((prev) =>
      (prev ?? []).map((g) => (g.id === id ? { ...g, name: trimmed } : g)).sort(byName),
    );
    const ok = await renameGroup(id, trimmed);
    if (!ok) {
      setGroups(previous);
      setNote("Couldn't rename the group.");
    }
  }

  async function handleDelete(id: string) {
    const previous = groups!;
    setGroups((prev) => (prev ?? []).filter((g) => g.id !== id));
    const ok = await removeGroup(id);
    if (!ok) {
      setGroups(previous);
      setNote("Couldn't delete the group.");
    }
  }

  async function handleAdd(groupId: string, studentId: string) {
    if (!studentId) return;
    const previous = groups!;
    setGroups((prev) =>
      (prev ?? []).map((g) =>
        g.id === groupId ? { ...g, memberIds: [...g.memberIds, studentId] } : g,
      ),
    );
    const ok = await addMember(groupId, studentId);
    if (!ok) {
      setGroups(previous);
      setNote("Couldn't add the student to the group.");
    }
  }

  async function handleRemove(groupId: string, studentId: string) {
    const previous = groups!;
    setGroups((prev) =>
      (prev ?? []).map((g) =>
        g.id === groupId
          ? { ...g, memberIds: g.memberIds.filter((id) => id !== studentId) }
          : g,
      ),
    );
    const ok = await removeMember(groupId, studentId);
    if (!ok) {
      setGroups(previous);
      setNote("Couldn't remove the student from the group.");
    }
  }

  // Round-robin the currently-unassigned roster into N brand-new groups.
  async function handleAutoSplit() {
    const n = Math.floor(splitN);
    if (n < 1 || unassigned.length === 0) {
      setNote("Nothing to split — no unassigned students (or invalid count).");
      return;
    }
    setBusy(true);
    setNote(null);
    const base = groups!.length;
    const created: CourseGroup[] = [];
    for (let i = 0; i < n; i++) {
      const g = await createGroup(course.id, `Group ${base + i + 1}`);
      if (!g) {
        setBusy(false);
        setNote("Couldn't create groups — a teaching account is required.");
        // Persist any groups that did get created.
        if (created.length) setGroups((prev) => [...(prev ?? []), ...created].sort(byName));
        return;
      }
      created.push(g);
    }
    unassigned.forEach((s, j) => {
      created[j % n].memberIds.push(s.id);
    });
    const results = await Promise.all(
      created.flatMap((g) => g.memberIds.map((sid) => addMember(g.id, sid))),
    );
    setGroups((prev) => [...(prev ?? []), ...created].sort(byName));
    if (results.some((ok) => !ok)) {
      setNote("Some students couldn't be added during the split.");
    }
    setBusy(false);
  }

  return (
    <>
      <PageHeader
        title="Groups"
        subtitle={`${groups.length} group${groups.length === 1 ? "" : "s"} in ${course.code}. Students may belong to more than one group.`}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="New group" className="w-56">
          <Input
            value={newName}
            placeholder="e.g. Lab team A"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
        </Field>
        <Button onClick={handleCreate} disabled={!newName.trim()}>
          Add group
        </Button>

        <span className="mx-1 hidden h-8 w-px bg-black/10 sm:block dark:bg-white/10" />

        <Field label="Auto-split unassigned into" className="w-40">
          <Input
            type="number"
            min={1}
            max={Math.max(1, unassigned.length)}
            value={splitN}
            onChange={(e) => setSplitN(Number(e.target.value) || 1)}
          />
        </Field>
        <Button
          variant="outline"
          onClick={handleAutoSplit}
          disabled={busy || unassigned.length === 0}
        >
          {busy ? "Splitting…" : "Auto-split"}
        </Button>
      </div>

      {note && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {note}
        </p>
      )}

      {groups.length === 0 ? (
        <div className="card mb-6 p-6 text-sm text-ink-muted">
          No groups yet. Add one above, or auto-split the roster.
        </div>
      ) : (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              byId={byId}
              roster={roster}
              groupsOf={groupsOf}
              onRename={handleRename}
              onDelete={handleDelete}
              onAdd={handleAdd}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      <UnassignedPanel students={unassigned} courseCode={course.code} />
    </>
  );
}

function GroupCard({
  group,
  byId,
  roster,
  groupsOf,
  onRename,
  onDelete,
  onAdd,
  onRemove,
}: {
  group: CourseGroup;
  byId: Map<string, RosterStudent>;
  roster: RosterStudent[];
  groupsOf: Map<string, string[]>;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAdd: (groupId: string, studentId: string) => void;
  onRemove: (groupId: string, studentId: string) => void;
}) {
  const [name, setName] = useState(group.name);
  useEffect(() => setName(group.name), [group.name]);

  // Enrolled students not already in THIS group (may be in others).
  const candidates = roster.filter((s) => !group.memberIds.includes(s.id));

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          aria-label="Group name"
          className="flex-1 font-semibold"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== group.name && onRename(group.id, name)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        <Badge tone="neutral">{group.memberIds.length}</Badge>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(group.id)}
          aria-label={`Delete ${group.name}`}
        >
          Delete
        </Button>
      </div>

      {group.memberIds.length === 0 ? (
        <p className="text-xs text-ink-faint">No members yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {group.memberIds.map((id) => {
            const s = byId.get(id);
            const also = (groupsOf.get(id) ?? []).filter((gn) => gn !== group.name);
            return (
              <li key={id} className="flex items-center gap-2">
                <Avatar
                  initials={initialsOf(s?.name ?? "?")}
                  color={s?.avatarColor ?? "#0284c7"}
                  size={26}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {s?.name ?? "Unknown student"}
                  </span>
                  {also.length > 0 && (
                    <span className="block truncate text-xs text-ink-faint">
                      also in {also.join(", ")}
                    </span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(group.id, id)}
                  aria-label={`Remove ${s?.name ?? "student"}`}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {candidates.length > 0 && (
        <Select
          aria-label="Add member"
          value=""
          onChange={(e) => onAdd(group.id, e.target.value)}
        >
          <option value="">Add member…</option>
          {candidates.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}

function UnassignedPanel({
  students,
  courseCode,
}: {
  students: RosterStudent[];
  courseCode: string;
}) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">Unassigned</h2>
        <Badge tone={students.length ? "warning" : "success"}>
          {students.length}
        </Badge>
      </div>
      {students.length === 0 ? (
        <p className="text-xs text-ink-faint">
          Every enrolled student in {courseCode} is in at least one group.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {students.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-full bg-surface-subtle px-2 py-1"
            >
              <Avatar initials={initialsOf(s.name)} color={s.avatarColor} size={22} />
              <span className="text-xs text-ink">{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ----------------------------- Student view ----------------------------- */

function StudentGroups({ course }: { course: Course }) {
  // RLS: a student reads the course's groups but only their OWN membership
  // rows, so memberIds here contains just themselves. We surface which groups
  // they've been placed in; other members are managed by the instructor.
  const [state, setState] = useState<
    { groups: CourseGroup[]; uid: string | null } | null | undefined
  >(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      const groups = await fetchCourseGroups(course.id);
      if (!alive) return;
      if (groups === null) {
        setState(null);
        return;
      }
      let uid: string | null = null;
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          uid = user?.id ?? null;
        } catch {
          /* ignore */
        }
      }
      if (alive) setState({ groups, uid });
    })();
    return () => {
      alive = false;
    };
  }, [course.id]);

  if (state === undefined) {
    return (
      <>
        <PageHeader title="Groups" subtitle={`Your groups in ${course.code}.`} />
        <div className="card p-6 text-sm text-ink-muted">Loading…</div>
      </>
    );
  }

  // Signed-out / anonymous: there is no local demo for groups.
  if (state === null) {
    return (
      <>
        <PageHeader title="Groups" subtitle={`Your groups in ${course.code}.`} />
        <div className="card flex flex-col items-start gap-2 p-6">
          <p className="font-semibold text-ink">Sign in to see your groups</p>
          <p className="text-sm text-ink-muted">
            Groups are set up by your instructor. Sign in to see which
            group{course.code ? ` in ${course.code}` : ""} you&apos;ve been placed in.
          </p>
        </div>
      </>
    );
  }

  const mine = state.uid
    ? state.groups.filter((g) => g.memberIds.includes(state.uid!))
    : state.groups.filter((g) => g.memberIds.length > 0);

  return (
    <>
      <PageHeader title="Groups" subtitle={`Your groups in ${course.code}.`} />
      {mine.length === 0 ? (
        <div className="card flex flex-col items-start gap-2 p-6">
          <p className="font-semibold text-ink">Not in a group yet</p>
          <p className="text-sm text-ink-muted">
            You haven&apos;t been placed in a group for this course yet. When
            your instructor adds you to one, it&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-black/5">
          {mine.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-3 p-4">
              <span className="text-sm font-medium text-ink">{g.name}</span>
              <Badge tone="brand">You&apos;re a member</Badge>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const byName = (a: CourseGroup, b: CourseGroup) => a.name.localeCompare(b.name);
