"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Admin control to advance the institution's active term (app_settings,
 * migration 0029). Writes go straight through the browser client — RLS
 * enforces admin-only writes, no service role needed. Advancing the term
 * doesn't migrate enrolment rows; old terms remain intact history, and an
 * admin re-enrols people into the new term separately (via "Subjects").
 */
export function TermControl({ currentTerm }: { currentTerm: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentTerm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openModal() {
    setValue(currentTerm);
    setError(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const next = value.trim();
    if (!next || next === currentTerm) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Not configured.");
        return;
      }
      const { error: upsertError } = await supabase
        .from("app_settings")
        .upsert({ key: "current_term", value: next });
      if (upsertError) {
        setError("Couldn't change the term — admins only.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Couldn't change the term.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/10 px-3 text-xs font-semibold text-ink hover:bg-surface-subtle dark:border-white/10"
      >
        <CalendarClock className="h-3.5 w-3.5" /> Term: {currentTerm}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Advance the term"
        description="Everyone's course lists come from this term's enrolments. Re-enrol people into the new term separately — old terms stay intact as history."
      >
        <form onSubmit={save} className="space-y-3">
          <Field label="Term">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Spring 2027"
              autoFocus
              required
            />
          </Field>
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
