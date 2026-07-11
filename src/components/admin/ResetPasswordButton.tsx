"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * Admin control to reset a forgotten login. Confirms, then asks the server to
 * generate a fresh temporary password (same shape as account creation) and
 * shows it once for the admin to hand over — addresses aren't real mailboxes,
 * so there's no email-reset flow.
 */
export function ResetPasswordButton({
  userId,
  name,
  enabled,
}: {
  userId: string;
  name: string;
  enabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function start() {
    setError(null);
    setPassword(null);
    setCopied(false);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setBusy(false);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json().catch(() => null)) as
        | { password?: string; error?: string }
        | null;
      if (!res.ok || !data?.password) {
        setError(data?.error ?? "Couldn't reset the password.");
        return;
      }
      setPassword(data.password);
    } catch {
      setError("Couldn't reset the password.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(
        `MoAcademy login for ${name}\nTemporary password: ${password}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* value is visible on screen */
    }
  }

  return (
    <>
      <button
        onClick={start}
        disabled={!enabled}
        title={enabled ? "Reset password" : "Add SUPABASE_SERVICE_ROLE_KEY to enable"}
        aria-label={`Reset password for ${name}`}
        className="focus-ring inline-flex h-7 items-center gap-1 rounded-md border border-black/10 px-2 text-xs font-medium text-ink-muted hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10"
      >
        <KeyRound className="h-3.5 w-3.5" /> Reset password
      </button>

      <Modal
        open={open}
        onClose={close}
        title={password ? "Password reset" : `Reset password — ${name}`}
        description={
          password
            ? "Share this with them. They set their own password on next sign-in."
            : "This issues a new temporary password and signs them out of the old one. Continue?"
        }
      >
        {password ? (
          <div className="space-y-4">
            <dl className="grid gap-2 rounded-lg bg-surface-subtle p-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Name</dt>
                <dd className="font-medium text-ink">{name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Temporary password</dt>
                <dd className="font-mono font-semibold text-ink">{password}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copy}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy details
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={close}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button onClick={confirm} disabled={busy}>
                {busy ? "Resetting…" : "Reset password"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
