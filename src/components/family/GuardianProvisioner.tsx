"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ShieldCheck, X } from "lucide-react";

const DONE_KEY = "moacademy.guardian.provisioned";

interface ProvisionResult {
  ok?: boolean;
  guardianEmail?: string;
  guardianName?: string | null;
  tempPassword?: string | null;
  alreadyProvisioned?: boolean;
  existingAccount?: boolean;
  skipped?: string;
}

/**
 * Runs once on the student dashboard: asks the server to create/link the
 * parent account the student named at signup, and — only when a new account
 * was created — shows the temporary password once so the student can pass it
 * to their guardian. Everything else (no guardian named, already done) is a
 * silent no-op. Safe when guardian accounts aren't configured (503 → ignored).
 */
export function GuardianProvisioner() {
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DONE_KEY)) return;

    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/guardians/provision", { method: "POST" });
        if (!res.ok) return; // not configured / transient — try again next time
        const data = (await res.json().catch(() => null)) as ProvisionResult | null;
        if (!alive || !data) return;
        if (data.tempPassword && data.guardianEmail) {
          setCreds({ email: data.guardianEmail, password: data.tempPassword });
          // Don't mark done yet — wait until the student acknowledges, so the
          // one-time password isn't lost on an accidental reload.
        } else {
          // Nothing to show (no guardian, already linked, existing account).
          window.localStorage.setItem(DONE_KEY, "1");
        }
      } catch {
        /* offline — retry on next visit */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!creds) return null;

  function dismiss() {
    window.localStorage.setItem(DONE_KEY, "1");
    setCreds(null);
  }

  async function copy() {
    if (!creds) return;
    try {
      await navigator.clipboard.writeText(
        `MoAcademy family login\nEmail: ${creds.email}\nTemporary password: ${creds.password}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the values are visible on screen anyway */
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50/70 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            Family account created
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            Share this temporary login with your parent/guardian. They can sign
            in and change the password from their account.
          </p>
          <dl className="mt-3 grid gap-1 rounded-lg bg-surface p-3 text-sm ring-1 ring-black/5 dark:ring-white/10">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-faint">Email</dt>
              <dd className="font-medium text-ink">{creds.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-faint">Temporary password</dt>
              <dd className="font-mono font-semibold text-ink">
                {creds.password}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={copy}
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copy details
                </>
              )}
            </button>
            <button
              onClick={dismiss}
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-subtle"
            >
              I&apos;ve shared it
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="focus-ring -mr-1 -mt-1 rounded-lg p-1 text-ink-faint hover:bg-surface-subtle"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
