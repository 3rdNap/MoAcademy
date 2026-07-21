"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Bot,
  ChevronRight,
  ClipboardList,
  Download,
  GraduationCap,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { AddPersonButton } from "@/components/admin/AddPersonButton";
import { AutomationToggle } from "@/components/admin/AutomationToggle";
import { ImportPeopleButton } from "@/components/admin/ImportPeopleButton";
import { ManageSubjectsButton } from "@/components/admin/ManageSubjectsButton";
import { ResetPasswordButton } from "@/components/admin/ResetPasswordButton";
import { TermControl } from "@/components/admin/TermControl";
import { useRole } from "@/components/role/RoleProvider";
import { isAdmin, roleLabel } from "@/lib/role";
import { roster } from "@/lib/roster";
import { formatMoney } from "@/lib/billing/pricing";
import { subjects } from "@/lib/billing/subjects";
import { formatDate, initialsOf, relativeTime } from "@/lib/utils";
import type {
  AdminEnrollment,
  AdminOverview,
  AutomationAgent,
  AutomationLogEntry,
} from "@/lib/data";
import type { Assignment, Course } from "@/lib/types";

export function AdminConsole({
  courses,
  assignments,
  overview,
  enrollments,
  currentUserId,
  currentTerm,
  agents = [],
  automationLog = [],
}: {
  courses: Course[];
  assignments: Assignment[];
  /** Real institution data for a signed-in admin; null falls back to demo. */
  overview: AdminOverview | null;
  /** Current-term enrolment rows for a signed-in admin; null falls back to demo. */
  enrollments: AdminEnrollment[] | null;
  currentUserId?: string;
  /** The institution's active term (app_settings, migration 0029). */
  currentTerm: string;
  /** Scheduled intelligent agents (migration 0039); empty when unavailable. */
  agents?: AutomationAgent[];
  /** Recent automation activity (migration 0039); empty when unavailable. */
  automationLog?: AutomationLogEntry[];
}) {
  const { role, hydrated } = useRole();
  const router = useRouter();
  const [peopleQuery, setPeopleQuery] = useState("");

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

  // Filter the real People list by name / email / role.
  const q = peopleQuery.trim().toLowerCase();
  const filteredPeople = overview
    ? q
      ? overview.people.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.email.toLowerCase().includes(q) ||
            p.role.includes(q),
        )
      : overview.people
    : [];

  // Real institution data when a live admin is signed in; demo otherwise.
  const studentCount = overview ? overview.counts.students : roster.length;
  const instructorCount = overview
    ? overview.counts.instructors
    : Array.from(new Set(courses.map((c) => c.instructor))).length;

  // Group the current-term enrolment rows by subject for the Enrollments view.
  const enrollmentGroups = enrollments
    ? (() => {
        const byCode = new Map<
          string,
          { students: string[]; instructors: string[] }
        >();
        for (const e of enrollments) {
          const g = byCode.get(e.subjectCode) ?? {
            students: [],
            instructors: [],
          };
          if (e.role === "instructor") g.instructors.push(e.name || "—");
          else if (e.role === "student") g.students.push(e.name || "—");
          byCode.set(e.subjectCode, g);
        }
        return Array.from(byCode.entries())
          .map(([code, g]) => ({
            code,
            name: subjects.find((s) => s.code === code)?.name ?? code,
            students: g.students.sort((a, b) => a.localeCompare(b)),
            instructors: g.instructors,
          }))
          .filter((g) => g.students.length + g.instructors.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));
      })()
    : [];

  return (
    <>
      <PageHeader
        title="Admin console"
        subtitle={
          overview
            ? "Live institution overview."
            : "Demo overview — sign in as an admin to see real data."
        }
        action={<TermControl currentTerm={currentTerm} />}
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
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-faint">
              People
              {overview && <Badge tone="neutral">{overview.people.length}</Badge>}
            </h2>
            <div className="flex items-center gap-2">
              <ImportPeopleButton enabled={roleMgmt} />
              <AddPersonButton enabled={roleMgmt} />
            </div>
          </div>
          {overview && overview.people.length > 5 && (
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={peopleQuery}
                onChange={(e) => setPeopleQuery(e.target.value)}
                placeholder="Search name, email or role…"
                aria-label="Search people"
                className="focus-ring w-full rounded-lg border border-black/10 bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint dark:border-white/10"
              />
            </div>
          )}
          <div className="card divide-y divide-black/5">
            {overview
              ? (filteredPeople.length === 0 ? (
                  <p className="p-4 text-sm text-ink-faint">No people match “{peopleQuery}”.</p>
                ) : (
                  filteredPeople.map((p) => (
                    <RealPerson
                      key={p.id}
                      person={p}
                      editable={roleMgmt && p.id !== currentUserId}
                      manageEnrollment={roleMgmt}
                      onChangeRole={(next) => changeRole(p.id, next)}
                    />
                  ))
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
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-faint">
              Registrations
              <Badge tone="neutral">{overview.registrations.length}</Badge>
            </h2>
            {overview.registrations.length > 0 && (
              <button
                onClick={() => exportRegistrationsCsv(overview.registrations)}
                className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/10 px-3 text-xs font-semibold text-ink hover:bg-surface-subtle dark:border-white/10"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            )}
          </div>
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

      {/* Enrollments — per-subject rosters for the active term */}
      {enrollments && (
        <section id="enrollments" className="mt-8 scroll-mt-24">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-faint">
              Enrollments
              <Badge tone="neutral">{enrollmentGroups.length}</Badge>
            </h2>
            <span className="text-xs text-ink-faint">Term {currentTerm}</span>
          </div>
          {enrollmentGroups.length === 0 ? (
            <div className="card p-6 text-sm text-ink-muted">
              No enrolments yet this term — assign subjects from the People list
              or Import people.
            </div>
          ) : (
            <div className="card divide-y divide-black/5">
              {enrollmentGroups.map((g) => (
                <details key={g.code} className="group">
                  <summary className="focus-ring flex cursor-pointer list-none items-center gap-3 p-3 hover:bg-surface-subtle">
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-open:rotate-90" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {g.name}
                      </p>
                      <p className="truncate text-xs text-ink-faint">
                        {g.code} ·{" "}
                        {g.instructors.length
                          ? g.instructors.join(", ")
                          : "No instructor assigned"}
                      </p>
                    </div>
                    <Badge tone="neutral">
                      {g.students.length} student
                      {g.students.length === 1 ? "" : "s"}
                    </Badge>
                  </summary>
                  <div className="px-3 pb-3 pl-10">
                    {g.students.length === 0 ? (
                      <p className="text-xs text-ink-faint">
                        No students enrolled yet.
                      </p>
                    ) : (
                      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {g.students.map((name, i) => (
                          <li
                            key={`${g.code}-${i}`}
                            className="truncate text-sm text-ink-muted"
                          >
                            {name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Reports & processes — institution-wide CSV exports */}
      {overview && (
        <section id="reports" className="mt-8 scroll-mt-24">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Reports &amp; processes
          </h2>
          <div className="card flex flex-wrap gap-2 p-4">
            <ExportButton
              label="People (CSV)"
              onClick={() => exportPeopleCsv(overview.people)}
              disabled={overview.people.length === 0}
            />
            <ExportButton
              label="Enrolments (CSV)"
              onClick={() =>
                exportEnrollmentsCsv(enrollments ?? [], currentTerm)
              }
              disabled={(enrollments ?? []).length === 0}
            />
            <ExportButton
              label="Registrations (CSV)"
              onClick={() => exportRegistrationsCsv(overview.registrations)}
              disabled={overview.registrations.length === 0}
            />
          </div>
        </section>
      )}

      {/* Automations — scheduled intelligent agents (migration 0039) */}
      {agents.length > 0 && (
        <section id="automations" className="mt-8 scroll-mt-24">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-faint">
              <Bot className="h-4 w-4" /> Automations
              <Badge tone="neutral">{agents.length}</Badge>
            </h2>
          </div>
          <p className="mb-3 text-xs text-ink-muted">
            Scheduled agents run nightly and message students in-app. Toggle them
            here.
          </p>

          <div className="card divide-y divide-black/5">
            {agents.map((a) => (
              <div key={a.key} className="flex items-start gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15">
                  <Bot className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{a.name}</p>
                  <p className="text-xs text-ink-muted">{a.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={a.enabled ? "success" : "neutral"}>
                    {a.enabled ? "On" : "Off"}
                  </Badge>
                  <AutomationToggle
                    agentKey={a.key}
                    enabled={a.enabled}
                    label={a.name}
                  />
                </div>
              </div>
            ))}
          </div>

          <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Recent activity
          </h3>
          {automationLog.length === 0 ? (
            <div className="card p-6 text-sm text-ink-muted">
              No automated messages sent yet. Agents act when assignments have
              upcoming or missed deadlines.
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 bg-surface-subtle text-left text-xs uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-3 font-semibold">Agent</th>
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Assignment</th>
                    <th className="px-4 py-3 font-semibold">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {automationLog.map((entry) => (
                    <tr key={entry.id} className="hover:bg-surface-subtle">
                      <td className="px-4 py-3 text-ink">
                        {agents.find((a) => a.key === entry.agentKey)?.name ??
                          entry.agentKey}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {entry.studentName || "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {entry.detail || "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-faint">
                        {relativeTime(entry.createdAt)}
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

function ExportButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/10 px-3 text-xs font-semibold text-ink hover:bg-surface-subtle disabled:opacity-40 dark:border-white/10"
    >
      <Download className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

/** Escape, assemble and download a CSV (BOM-prefixed for Excel). */
function downloadCsv(
  slug: string,
  header: string[],
  rows: (string | number)[][],
): void {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows]
    .map((row) => row.map(esc).join(","))
    .join("\r\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `moacademy-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Build a CSV from the registrations and trigger a browser download. */
function exportRegistrationsCsv(
  registrations: AdminOverview["registrations"],
): void {
  downloadCsv(
    "registrations",
    ["Invoice", "Student", "Email", "Subjects", "Total (ZAR)", "Status", "Date"],
    registrations.map((r) => [
      r.invoiceNo,
      r.payerName,
      r.payerEmail,
      r.subjects.join("; "),
      (r.totalCents / 100).toFixed(2),
      r.status,
      new Date(r.createdAt).toISOString().slice(0, 10),
    ]),
  );
}

/** People roster export — name, email, role. */
function exportPeopleCsv(people: AdminOverview["people"]): void {
  downloadCsv(
    "people",
    ["Name", "Email", "Role"],
    people.map((p) => [p.name, p.email, p.role]),
  );
}

/** Current-term enrolments export — subject code, subject name, person, role, term. */
function exportEnrollmentsCsv(
  enrollments: AdminEnrollment[],
  term: string,
): void {
  downloadCsv(
    "enrolments",
    ["Subject code", "Subject name", "Person", "Role", "Term"],
    enrollments.map((e) => [
      e.subjectCode,
      subjects.find((s) => s.code === e.subjectCode)?.name ?? e.subjectCode,
      e.name,
      e.role,
      term,
    ]),
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
  manageEnrollment,
  onChangeRole,
}: {
  person: AdminOverview["people"][number];
  editable: boolean;
  manageEnrollment: boolean;
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

  const canEnroll = person.role === "student" || person.role === "instructor";

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
        <div className="mt-1 flex flex-wrap gap-1.5">
          {canEnroll && (
            <ManageSubjectsButton
              userId={person.id}
              name={person.name || person.email}
              role={person.role as "student" | "instructor"}
              enabled={manageEnrollment}
            />
          )}
          <ResetPasswordButton
            userId={person.id}
            name={person.name || person.email}
            enabled={manageEnrollment}
          />
        </div>
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
