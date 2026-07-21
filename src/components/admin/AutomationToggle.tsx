"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Enabled toggle for a scheduled agent (automation_agents, migration 0039).
 * Writes go straight through the browser client — admin RLS enforces the write.
 * Optimistic: flip immediately, revert with an inline error on failure
 * (mirrors TermControl's error handling).
 */
export function AutomationToggle({
  agentKey,
  enabled,
  label,
}: {
  agentKey: string;
  enabled: boolean;
  label: string;
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    const next = !on;
    setOn(next);
    setBusy(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setOn(!next);
        setError("Not configured.");
        return;
      }
      const { error: updateError } = await supabase
        .from("automation_agents")
        .update({ enabled: next })
        .eq("key", agentKey);
      if (updateError) {
        setOn(!next);
        setError("Couldn't change this — admins only.");
        return;
      }
      router.refresh();
    } catch {
      setOn(!next);
      setError("Couldn't change this.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${on ? "Disable" : "Enable"} ${label}`}
        onClick={toggle}
        disabled={busy}
        className={`focus-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          on ? "bg-brand-600" : "bg-black/15 dark:bg-white/20"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
