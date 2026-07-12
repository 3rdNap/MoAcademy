"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label, Select } from "@/components/ui/form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Shared sign-in / sign-up form. mode controls which flow it runs. */
export function AuthCard({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const isSignup = mode === "signup";

  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "instructor">("student");
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(
        "Sign-in isn't available yet: this deployment hasn't picked up the " +
          "Supabase keys. Check /api/status — if it shows \"supabase\": false, " +
          "add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in " +
          "Vercel and redeploy.",
      );
      return;
    }
    setBusy(true);
    try {
      if (isSignup) {
        const metadata: Record<string, string> = { full_name: name, role };
        // Students may name a parent/guardian. We stash it on the student's own
        // account; a guardian account is provisioned from the dashboard once
        // the student is signed in (see GuardianProvisioner).
        if (role === "student" && guardianEmail.trim()) {
          metadata.guardian_name = guardianName.trim();
          metadata.guardian_email = guardianEmail.trim();
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: metadata },
        });
        if (error) throw error;
        // If email confirmation is on, there's no session yet.
        if (!data.session) {
          setNotice("Check your email to confirm your account, then sign in.");
          setBusy(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
      <div className="card p-6">
        <div className="mb-5 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-2 ring-1 ring-black/10 dark:ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mo-mark.png" alt="MoAcademy" className="h-full w-full object-contain" />
          </span>
          <h1 className="mt-3 text-xl font-bold text-ink">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-ink-muted">
            {isSignup ? "Join MoAcademy" : "Sign in to MoAcademy"}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {isSignup && (
            <>
              <Field label="Full name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Morgan Sefako"
                  required
                />
              </Field>
              <div>
                <Label htmlFor="role">I am a</Label>
                <Select
                  id="role"
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "student" | "instructor")
                  }
                >
                  <option value="student">Student</option>
                  <option value="instructor">Instructor</option>
                </Select>
              </div>
              {role === "student" && (
                <div className="rounded-lg border border-black/10 bg-surface-subtle p-3 dark:border-white/10">
                  <p className="mb-2 text-xs font-medium text-ink-muted">
                    Parent / guardian (optional) — we&apos;ll create a family
                    account so they can follow your progress.
                  </p>
                  <div className="space-y-2">
                    <Field label="Guardian name">
                      <Input
                        value={guardianName}
                        onChange={(e) => setGuardianName(e.target.value)}
                        placeholder="Thandi Sefako"
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="Guardian email">
                      <Input
                        type="email"
                        value={guardianEmail}
                        onChange={(e) => setGuardianEmail(e.target.value)}
                        placeholder="parent@example.com"
                        autoComplete="off"
                      />
                    </Field>
                  </div>
                </div>
              )}
            </>
          )}
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </Field>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              {notice}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-muted">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-brand-600 hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              Accounts are issued by your institution.{" "}
              <Link href="/signup" className="font-medium text-brand-600 hover:underline">
                Learn more
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
