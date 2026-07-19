import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  GraduationCap,
  LayoutGrid,
  MessageSquare,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Widget } from "@/components/ui/Widget";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/billing/pricing";
import { formatDate } from "@/lib/utils";
import type { AdminDashboard, AdminOverview } from "@/lib/data";

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// One-line fix hint per system flag, shown when a check is failing.
const FIX_HINTS: Record<string, string> = {
  Database: "Add NEXT_PUBLIC_SUPABASE_URL and the anon key in your deployment env",
  "Account provisioning":
    "Add SUPABASE_SERVICE_ROLE_KEY in your deployment env",
  "Mo assistant": "Add ANTHROPIC_API_KEY in your deployment env",
};

const OPERATIONS = [
  {
    href: "/admin",
    label: "User management",
    desc: "Accounts, roles, passwords, bulk import",
    icon: Users,
  },
  {
    href: "/admin#enrollments",
    label: "Enrollments",
    desc: "Per-subject rosters this term",
    icon: ClipboardList,
  },
  {
    href: "/courses",
    label: "Course management",
    desc: "Catalogue, syllabus, content",
    icon: BookOpen,
  },
  {
    href: "/grades",
    label: "Gradebooks",
    desc: "Grades across the institution",
    icon: GraduationCap,
  },
  {
    href: "/admin#reports",
    label: "Reports & processes",
    desc: "Exports: people, enrolments, registrations",
    icon: LayoutGrid,
  },
  {
    href: "/inbox",
    label: "Messages",
    desc: "Institution-wide messaging",
    icon: MessageSquare,
  },
] as const;

/**
 * Admin home rebuilt to the D2L Brightspace operations model: stat tiles
 * (active users / active courses / system alerts / messages), an operations
 * grid linking into each real surface, an environment status card, and the
 * institutional registration history. Both data props may be null (anonymous
 * demo preview / backend offline) — the tiles degrade to zeros and the status
 * card hides rather than breaking the page.
 */
export function AdminHome({
  name,
  overview,
  dashboard,
  currentTerm,
}: {
  name: string;
  overview: AdminOverview | null;
  dashboard: AdminDashboard | null;
  currentTerm: string;
}) {
  const activeUsers = dashboard?.activeUsers ?? 0;
  const termCourses = dashboard?.termCourses ?? [];
  const currentTermCourses =
    termCourses.find((t) => t.term === currentTerm) ?? termCourses[0];
  const flags = dashboard?.systemFlags ?? [];
  const alertCount = flags.filter((f) => !f.ok).length;
  const unread = dashboard?.unreadMessages ?? 0;
  const recent = overview?.registrations.slice(0, 5) ?? [];

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${name.split(" ")[0]}`}
        subtitle={`Admin overview · ${formatDate(new Date().toISOString())}`}
        action={
          <Link
            href="/admin"
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <ShieldCheck className="h-4 w-4" /> Open console
          </Link>
        }
      />

      {/* Stat tiles — D2L parity */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={<Users className="h-5 w-5" />}
          label="Active users"
          value={String(activeUsers)}
          tone="text-brand-600"
        />
        <StatTile
          icon={<BookOpen className="h-5 w-5" />}
          label="Active courses"
          value={String(currentTermCourses?.subjects ?? 0)}
          tone="text-sky-600"
          lines={termCourses.map(
            (t) => `${t.term}: ${t.subjects} subj · ${t.enrollments} enrol`,
          )}
        />
        <StatTile
          icon={<ShieldCheck className="h-5 w-5" />}
          label="System alerts"
          value={String(alertCount)}
          tone={alertCount === 0 ? "text-emerald-600" : "text-rose-600"}
        />
        <Link href="/inbox" className="focus-ring rounded-xl">
          <StatTile
            icon={<MessageSquare className="h-5 w-5" />}
            label="My messages"
            value={String(unread)}
            tone={unread > 0 ? "text-amber-600" : "text-ink-muted"}
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Operations grid */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Operations
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {OPERATIONS.map((op) => {
              const Icon = op.icon;
              return (
                <Link
                  key={op.href}
                  href={op.href}
                  className="card focus-ring flex items-center gap-3 p-4 hover:bg-surface-subtle"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-ink">{op.label}</p>
                    <p className="text-xs text-ink-muted">{op.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Side column: system status + registration history */}
        <div className="space-y-6">
          {flags.length > 0 && (
            <Widget
              title="System status"
              icon={<ShieldCheck className="h-4 w-4 text-brand-600" />}
            >
              <ul className="space-y-3">
                {flags.map((f) => (
                  <li key={f.label} className="flex items-start gap-2">
                    {f.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{f.label}</p>
                      {!f.ok && (
                        <p className="text-xs text-ink-muted">
                          {FIX_HINTS[f.label] ?? "Not configured."}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Widget>
          )}

          <Widget
            title="Recent registrations"
            icon={<CreditCard className="h-4 w-4 text-brand-600" />}
            action={
              <Link
                href="/admin"
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                All
              </Link>
            }
          >
            {recent.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No registrations yet. Institutional history appears here.
              </p>
            ) : (
              <ul className="space-y-3">
                {recent.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {r.payerName || r.payerEmail || "—"}
                      </p>
                      <p className="truncate text-xs text-ink-faint">
                        {r.subjects.join(", ") || "—"}
                      </p>
                    </div>
                    <Badge tone={r.status === "paid" ? "success" : "warning"}>
                      {formatMoney(r.totalCents / 100)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Widget>
        </div>
      </div>
    </>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone,
  lines,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
  lines?: string[];
}) {
  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-lg bg-surface-subtle ${tone}`}
        >
          {icon}
        </span>
        <div>
          <p className="text-xl font-bold leading-none text-ink">{value}</p>
          <p className="mt-1 text-xs text-ink-muted">{label}</p>
        </div>
      </div>
      {lines && lines.length > 0 && (
        <ul className="mt-1 space-y-0.5 border-t border-black/5 pt-2 text-xs text-ink-faint dark:border-white/5">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
