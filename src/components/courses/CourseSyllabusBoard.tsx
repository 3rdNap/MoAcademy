"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/form";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { useLocalCollection } from "@/lib/local-store";
import { saveRemoteSyllabus } from "@/lib/course-content-db";
import { getSignedInUserId } from "@/lib/study-guides-db";
import { relativeTime } from "@/lib/utils";
import type { Course } from "@/lib/types";

type SyllabusView = { body: string; updatedBy: string; updatedAt: string };
type SyllabusDoc = { id: string } & SyllabusView;

// The anonymous demo keeps a single local document under a fixed id.
const DOC_ID = "doc";

export function CourseSyllabusBoard({
  course,
  initial,
  userName,
}: {
  course: Course;
  initial: SyllabusView | null;
  userName: string;
}) {
  const { role, hydrated } = useRole();
  const teaching = hydrated && canTeach(role);

  const local = useLocalCollection<SyllabusDoc>(
    `moacademy.syllabus.${course.id}`,
    [],
  );
  const localDoc = local.items.find((d) => d.id === DOC_ID) ?? null;

  const [signedIn, setSignedIn] = useState(false);
  const [remote, setRemote] = useState<SyllabusView | null>(initial);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pubNote, setPubNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSignedInUserId().then((id) => alive && setSignedIn(Boolean(id)));
    return () => {
      alive = false;
    };
  }, []);

  // Signed-in users read the shared server row; the anonymous demo reads its
  // local copy.
  const doc = useMemo<SyllabusView | null>(
    () => (signedIn ? remote : localDoc),
    [signedIn, remote, localDoc],
  );
  const hasBody = Boolean(doc?.body.trim());

  function openEdit() {
    setDraft(doc?.body ?? "");
    setPubNote(null);
    setOpen(true);
  }

  async function save() {
    const body = draft.trim();
    const now = new Date().toISOString();

    if (signedIn) {
      // Publish to the shared table; a refused write (not a teaching account)
      // surfaces the amber note instead of silently succeeding.
      if (await saveRemoteSyllabus(course.id, body, userName)) {
        setRemote({ body, updatedBy: userName, updatedAt: now });
        setOpen(false);
        return;
      }
      setPubNote("Couldn't save the syllabus — a teaching account is required.");
      return;
    }

    const next: SyllabusDoc = { id: DOC_ID, body, updatedBy: userName, updatedAt: now };
    if (localDoc) local.update(DOC_ID, next);
    else local.add(next);
    setOpen(false);
  }

  return (
    <>
      <PageHeader
        title="Syllabus"
        subtitle={`Course overview for ${course.code}.`}
        action={
          teaching ? (
            <Button variant={hasBody ? "outline" : "primary"} onClick={openEdit}>
              <Pencil className="h-4 w-4" /> Edit syllabus
            </Button>
          ) : undefined
        }
      />

      {pubNote && !open && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {pubNote}
        </p>
      )}

      {hasBody ? (
        <article className="card p-6">
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
            {doc!.body}
          </div>
          {doc!.updatedBy && (
            <p className="mt-6 border-t border-black/5 pt-3 text-xs text-ink-faint dark:border-white/5">
              Updated by {doc!.updatedBy}
              {doc!.updatedAt && ` · ${relativeTime(doc!.updatedAt)}`}
            </p>
          )}
        </article>
      ) : (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <ScrollText className="h-8 w-8 text-ink-faint" />
          <p className="text-sm text-ink-muted">No syllabus posted yet.</p>
          {teaching && (
            <p className="text-xs text-ink-faint">
              Add one so students know what to expect this term.
            </p>
          )}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit syllabus"
        description="Visible to everyone enrolled in this course."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save syllabus</Button>
          </>
        }
      >
        {pubNote && <p className="mb-2 text-xs text-rose-600">{pubNote}</p>}
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Course description, grading policy, weekly schedule, expectations…"
          className="min-h-[280px]"
        />
      </Modal>
    </>
  );
}
