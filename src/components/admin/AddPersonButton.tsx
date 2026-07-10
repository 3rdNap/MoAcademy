"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label, Select } from "@/components/ui/form";

interface CreatedAccount {
  name: string;
  email: string;
  tempPassword: string;
  role: string;
}

/**
 * Admin-only "issue an account" flow. Collects a name + role (and an optional
 * guardian for students), asks the server to provision a name@moacademy.com
 * login with a temporary password, then shows those credentials once for the
 * admin to hand over. Disabled when provisioning isn't configured.
 */
export function AddPersonButton({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("student");
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedAccount | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setFullName("");
    setRole("student");
    setGuardianName("");
    setGuardianEmail("");
    setError(null);
    setResult(null);
    setCopied(false);
    setBusy(false);
  }

  function close() {
    setOpen(false);
    // If we just created someone, refresh the People list on the way out.
    if (result) router.refresh();
    reset();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          role,
          guardianName: role === "student" ? guardianName : undefined,
          guardianEmail: role === "student" ? guardianEmail : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | (CreatedAccount & { error?: string })
        | null;
      if (!res.ok || !data?.email) {
        setError(data?.error ?? "Couldn't create the account.");
        return;
      }
      setResult({
        name: data.name,
        email: data.email,
        tempPassword: data.tempPassword,
        role: data.role,
      });
    } catch {
      setError("Couldn't create the account.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(
        `MoAcademy login for ${result.name}\nEmail: ${result.email}\nTemporary password: ${result.tempPassword}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* values are visible on screen */
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!enabled}
        title={enabled ? undefined : "Add SUPABASE_SERVICE_ROLE_KEY to enable"}
        className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UserPlus className="h-3.5 w-3.5" /> Add person
      </button>

      <Modal
        open={open}
        onClose={close}
        title={result ? "Account created" : "Add a person"}
        description={
          result
            ? "Share these details with them. They set their own password on first sign-in."
            : "Issue a MoAcademy login. The system generates the email and a temporary password."
        }
      >
        {result ? (
          <div className="space-y-4">
            <dl className="grid gap-2 rounded-lg bg-surface-subtle p-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Name</dt>
                <dd className="font-medium text-ink">{result.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Role</dt>
                <dd className="font-medium capitalize text-ink">{result.role}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Email (login)</dt>
                <dd className="font-medium text-ink">{result.email}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Temporary password</dt>
                <dd className="font-mono font-semibold text-ink">
                  {result.tempPassword}
                </dd>
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
              <Button variant="outline" onClick={reset}>
                Add another
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Field label="Full name">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Thabo Mokoena"
                required
                autoFocus
              />
            </Field>
            <div>
              <Label htmlFor="new-role">Role</Label>
              <Select
                id="new-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                <option value="admin">Admin</option>
                <option value="parent">Parent / guardian</option>
              </Select>
            </div>
            {role === "student" && (
              <div className="rounded-lg border border-black/10 bg-surface-subtle p-3 dark:border-white/10">
                <p className="mb-2 text-xs font-medium text-ink-muted">
                  Parent / guardian (optional) — a family account is created when
                  the student first signs in.
                </p>
                <div className="space-y-2">
                  <Field label="Guardian name">
                    <Input
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="Thandi Mokoena"
                    />
                  </Field>
                  <Field label="Guardian email">
                    <Input
                      type="email"
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                      placeholder="parent@example.com"
                    />
                  </Field>
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create account"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
