"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useRole } from "@/components/role/RoleProvider";
import { isAdmin, roleLabel } from "@/lib/role";
import { roster } from "@/lib/roster";
import { formatMoney } from "@/lib/billing/pricing";
import { formatDate, initialsOf } from "@/lib/utils";
import type { AdminOverview } from "@/lib/data";
import type { Assignment, Course } from "@/lib/types";

export function AdminConsole({
  courses,
  assignments,
  overview,
  currentUserId,
}: {
  courses: Course[];
  assignments: Assignment[];
  /** Real institution data for a signed-in admin; null falls back to demo. */
  overview: AdminOverview | null;
  currentUserId?: string;
}) {
  const { role, hydrated } = useRole();
  const router = useRouter();

  // Role editing needs the server-only service key; probe once.
  const [roleMgmt, setRoleMgmt] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => alive && setRoleMgmt(Boolean(d?.roleManagement)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function changeRole(userId: string, next: string): Promise<string | null> {
    const res = await fetch("/api/admin/set-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: next }),
    });
    if (res.ok) {
      router.refresh();
      return null;
    }
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return data?.error ?? "Couldn't update the role.";
  }

  if (!hydrated) return null;

  if (!isAdmin(role)) {
    return (
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div>
          <p className="font-semibold text-ink">Administrators only</p>
          <p className="mt-1 text-sm text-ink-muted">
            Switch to <span className="font-medium">Admin</span> in the top-bar
            role selector to view the console.
          </p>
        </div>
      </div>
    );
  }

  const published = courses.filter((c) => c.published).length;

  // Real institution data when a live admin is signed in; demo otherwise.
  const studentCount = overview ? overview.counts.students : roster.length;
  const instructorCount = overview
    ? overview.counts.instructors
    : Array.from(new Set(courses.map((c) => c.instructor))).length;

  return (
    <>
      <PageHeader
        title="Admin console"
        subtitle={
          overview
            ? "Live institution overview."
            : "Demo overview — sign in as an admin to see real data."
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat icon={<Users className="h-5 w-5" />} label="Students" value={studentCount} tone="text-brand-600" />
        <Stat icon={<GraduationCap className="h-5 w-5" />} label="Instructors" value={instructorCount} tone="text-sky-600" />
        <Stat icon={<BookOpen className="h-5 w-5" />} label="Subjects" value={`${published}/${courses.length}`} tone="text-emerald-600" />
        {overview ? (
          <>
            <Stat icon={<ClipboardList className="h-5 w-5" />} label="Registrations" value={overview.summary.paid} tone="text-amber-600" />
            <Stat icon={<TrendingUp className="h-5 w-5" />} label="Revenue" value={formatMoney(overview.summary.revenueCents / 100)} tone="text-violet-600" />
          </>
        ) : (
          <>
            <Stat icon={<ClipboardList className="h-5 w-5" />} label="Assignments" value={assignments.length} tone="text-amber-600" />
            <Stat icon={<TrendingUp className="h-5 w-5" />} label="Avg progress" value="—" tone="text-violet-600" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Courses table */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Courses
          </h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 bg-surface-subtle text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-3 font-semibold">Course</th>
                  <th className="px-4 py-3 font-semibold">Instructor</th>
                  <th className="px-4 py-3 font-semibold">Credits</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {courses.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-subtle">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-1 rounded-full" style={{ backgroundColor: c.color }} />
                        <div>
                          <p className="font-medium text-ink">{c.name}</p>
                          <p className="text-xs text-ink-faint">{c.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{c.instructor}</td>
                    <td className="px-4 py-3 text-ink-muted">{c.credits}</td>
                    <td className="px-4 py-3">
                      {c.published ? (
                        <Badge tone="success">Published</Badge>
                      ) : (
                        <Badge tone="neutral">Draft</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* People */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-faint">
            People
            {overview && <Badge tone="neutral">{overview.people.length}</Badge>}
          </h2>
          <div className="card divide-y divide-black/5">
            {overview
              ? overview.people.map((p) => (
                  <RealPerson
                    key={p.id}
                    person={p}
                    editable={roleMgmt && p.id !== currentUserId}
                    onChangeRole={(next) => changeRole(p.id, next)}
                  />
                ))
              : [
                  ...Array.from(new Set(courses.map((c) => c.instructor))).map(
                    (name) => (
                      <Person key={name} name={name} role="Instructor" />
                    ),
                  ),
                  ...roster.map((s) => (
                    <Person key={s.id} name={s.name} role="Student" />
                  )),
                ]}
          </div>
        </section>
      </div>

      {/* Registrations — real paid/pending invoices across the institution */}
      {overview && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Registrations
            <Badge tone="neutral">{overview.registrations.length}</Badge>
          </h2>
          {overview.registrations.length === 0 ? (
            <div className="card p-6 text-sm text-ink-muted">
              No registrations yet. They&apos;ll appear here as students pay.
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 bg-surface-subtle text-left text-xs uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-3 font-semibold">Invoice</th>
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Subjects</th>
                    <th className="px-4 py-3 font-semibold">Total</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {overview.registrations.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-subtle">
                      <td className="px-4 py-3 font-medium text-ink">
                        {r.invoiceNo || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-ink">{r.payerName || "—"}</p>
                        <p className="text-xs text-ink-faint">{r.payerEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {r.subjects.length ? r.subjects.join(", ") : "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">
                        {formatMoney(r.totalCents / 100)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={r.status === "paid" ? "success" : "warning"}>
                          {r.status === "paid" ? "Paid" : "Processing"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-ink-faint">
                        {formatDate(r.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="card flex items-center gap-3 p-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-lg bg-surface-subtle ${tone}`}>
        {icon}
      </span>
      <div>
        <p className="text-lg font-bold leading-none text-ink">{value}</p>
        <p className="mt-1 text-xs text-ink-muted">{label}</p>
      </div>
    </div>
  );
}

function Person({ name, role }: { name: string; role: "Instructor" | "Student" }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <Avatar
        initials={initialsOf(name)}
        color={role === "Instructor" ? "#0284c7" : "#8b94a3"}
        size={32}
      />
      <p className="flex-1 text-sm font-medium text-ink">{name}</p>
      <Badge tone={role === "Instructor" ? "brand" : "neutral"}>{role}</Badge>
    </div>
  );
}

function RealPerson({
  person,
  editable,
  onChangeRole,
}: {
  person: AdminOverview["people"][number];
  editable: boolean;
  onChangeRole: (next: string) => Promise<string | null>;
}) {
  const tone =
    person.role === "admin"
      ? "brand"
      : person.role === "instructor"
        ? "info"
        : "neutral";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSelect(next: string) {
    if (next === person.role || busy) return;
    setBusy(true);
    setError(null);
    const err = await onChangeRole(next);
    if (err) setError(err);
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-3 p-3">
      <Avatar
        initials={initialsOf(person.name || person.email)}
        color={person.avatarColor}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          {person.name || "—"}
        </p>
        <p className="truncate text-xs text-ink-faint">{person.email}</p>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
      {editable ? (
        <select
          value={person.role}
          disabled={busy}
          onChange={(e) => onSelect(e.target.value)}
          aria-label={`Role for ${person.name || person.email}`}
          className="focus-ring rounded-lg border border-black/10 bg-surface px-2 py-1 text-xs font-medium text-ink disabled:opacity-50 dark:border-white/10"
        >
          <option value="student">Student</option>
          <option value="instructor">Instructor</option>
          <option value="admin">Admin</option>
        </select>
      ) : (
        <Badge tone={tone}>{roleLabel[person.role]}</Badge>
      )}
    </div>
  );
}
