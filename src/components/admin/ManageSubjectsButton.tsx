"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { subjects } from "@/lib/billing/subjects";

/**
 * Admin control to enrol a person into subjects (as student, or as the
 * instructor who teaches them). Loads the person's current set, lets the admin
 * tick subjects, and replaces the set for the current term via /api/admin/enroll.
 */
export function ManageSubjectsButton({
  userId,
  name,
  role,
  enabled,
}: {
  userId: string;
  name: string;
  role: "student" | "instructor";
  enabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function load() {
    setOpen(true);
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/enroll?userId=${encodeURIComponent(userId)}&role=${role}`,
      );
      const data = (await res.json().catch(() => null)) as
        | { subjectCodes?: string[]; error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? "Couldn't load subjects.");
      } else {
        setSelected(new Set(data?.subjectCodes ?? []));
      }
    } catch {
      setError("Couldn't load subjects.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role, subjectCodes: Array.from(selected) }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Couldn't save.");
        return;
      }
      setSaved(true);
      setTimeout(() => setOpen(false), 700);
    } catch {
      setError("Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  // Group the catalogue by category for a tidy checklist.
  const byCategory = subjects.reduce<Record<string, typeof subjects>>(
    (acc, s) => {
      (acc[s.category] ??= []).push(s);
      return acc;
    },
    {},
  );

  return (
    <>
      <button
        onClick={load}
        disabled={!enabled}
        title={enabled ? "Manage subjects" : "Add SUPABASE_SERVICE_ROLE_KEY to enable"}
        aria-label={`Manage subjects for ${name}`}
        className="focus-ring inline-flex h-7 items-center gap-1 rounded-md border border-black/10 px-2 text-xs font-medium text-ink-muted hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10"
      >
        <BookOpen className="h-3.5 w-3.5" /> Subjects
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Subjects — ${name}`}
        description={
          role === "instructor"
            ? "Choose the subjects this instructor teaches."
            : "Choose the subjects this student is enrolled in."
        }
      >
        {loading ? (
          <p className="py-6 text-center text-sm text-ink-muted">Loading…</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(byCategory).map(([category, list]) => (
              <div key={category}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  {category}
                </p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {list.map((s) => {
                    const checked = selected.has(s.code);
                    return (
                      <label
                        key={s.code}
                        className={
                          "focus-within:ring-2 focus-within:ring-brand-500 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm " +
                          (checked
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                            : "border-black/10 hover:bg-surface-subtle dark:border-white/10")
                        }
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(s.code)}
                          className="h-4 w-4 accent-brand-600"
                        />
                        <span className="font-medium text-ink">{s.name}</span>
                        <span className="ml-auto text-xs text-ink-faint">{s.code}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-ink-faint">
                {selected.size} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={busy}>
                  {saved ? "Saved ✓" : busy ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
