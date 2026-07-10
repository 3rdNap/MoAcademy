"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * First-login password reset. Institution-issued accounts land here (via the
 * middleware gate) until they replace their temporary password with one of
 * their own; on success we clear the must_change_password flag and send them
 * to their dashboard.
 */
export function SetPasswordCard() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Sign-in isn't available on this deployment.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        data: { must_change_password: false },
      });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your password.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
      <div className="card p-6">
        <div className="mb-5 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-xl font-bold text-ink">Set your password</h1>
          <p className="text-sm text-ink-muted">
            Welcome to MoAcademy. Choose a password to replace the temporary one
            you were given.
          </p>
          {email && (
            <p className="mt-1 text-xs text-ink-faint">
              Signed in as <span className="font-medium">{email}</span>
            </p>
          )}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="New password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </Field>
          <Field label="Confirm password">
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </Field>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Save and continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
