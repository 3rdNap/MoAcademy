"use client";

import { useState } from "react";
import { Compass, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ChildPicker } from "@/components/family/ChildPicker";
import { daysUntil, formatDate } from "@/lib/utils";
import type { ChildApplication, GuardianChild } from "@/lib/data";

export interface ChildRoadmapView {
  child: GuardianChild;
  applications: ChildApplication[];
}

const STATUS: Record<
  string,
  { tone: "neutral" | "success" | "warning" | "danger" | "info"; label: string }
> = {
  not_started: { tone: "neutral", label: "Not started" },
  in_progress: { tone: "info", label: "In progress" },
  submitted: { tone: "success", label: "Submitted" },
  accepted: { tone: "success", label: "Accepted" },
  waitlisted: { tone: "warning", label: "Waitlisted" },
  rejected: { tone: "danger", label: "Unsuccessful" },
};

const DONE = new Set(["submitted", "accepted", "waitlisted", "rejected"]);

/**
 * A guardian's read-only view of a child's university applications — the
 * question a parent actually has is "are they in yet?", so the summary leads
 * with how many are submitted and what is closing soon.
 */
export function ChildRoadmap({ views }: { views: ChildRoadmapView[] }) {
  const [childId, setChildId] = useState(views[0]?.child.id ?? "");
  const current = views.find((v) => v.child.id === childId) ?? views[0];

  const header = (
    <div className="mb-6 overflow-hidden rounded-xl bg-gradient-to-br from-brand-700 to-brand-900 px-6 py-6 text-white shadow-card">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
          <Compass className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">University Roadmap</h1>
          <p className="text-sm text-white/85">
            Where your child is applying, and how far along each application is.
          </p>
        </div>
      </div>
    </div>
  );

  if (!current) {
    return (
      <div>
        {header}
        <div className="card p-6 text-sm text-ink-muted">
          No linked students yet. Their university applications appear here once
          the school links your child&apos;s account to yours.
        </div>
      </div>
    );
  }

  const { child, applications } = current;
  const firstName = child.name.split(" ")[0] || "your child";
  const submitted = applications.filter((a) => DONE.has(a.status));
  const closingSoon = applications.filter(
    (a) =>
      !DONE.has(a.status) &&
      a.closesAt != null &&
      daysUntil(a.closesAt) >= 0 &&
      daysUntil(a.closesAt) <= 30,
  );

  return (
    <div>
      {header}
      <ChildPicker views={views} childId={current.child.id} onSelect={setChildId} />

      {applications.length === 0 ? (
        <div className="card p-6 text-sm text-ink-muted">
          {firstName} hasn&apos;t added any university applications yet. When
          they do, each institution&apos;s deadline and progress shows here.
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tally label="Institutions" value={applications.length} />
            <Tally
              label="Applications in"
              value={submitted.length}
              tone="text-emerald-600"
            />
            <Tally
              label="Closing within 30 days"
              value={closingSoon.length}
              tone={closingSoon.length ? "text-amber-600" : undefined}
            />
          </div>

          <div className="card divide-y divide-black/5">
            {applications.map((a) => {
              const badge = STATUS[a.status] ?? STATUS.not_started;
              const days = a.closesAt ? daysUntil(a.closesAt) : null;
              const urgent =
                !DONE.has(a.status) && days != null && days >= 0 && days <= 30;
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{a.institution}</p>
                    <p className="text-xs text-ink-faint">
                      {a.program || "Programme not set"}
                      {a.closesAt && ` · closes ${formatDate(a.closesAt)}`}
                    </p>
                  </div>
                  {urgent && (
                    <Badge tone="warning">
                      {days === 0 ? "Closes today" : `${days} days left`}
                    </Badge>
                  )}
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                  {a.applyUrl && (
                    <a
                      href={a.applyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-subtle dark:border-white/10"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Portal
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-3 text-xs text-ink-faint">
        This view is read-only — {firstName} keeps their own roadmap up to date.
      </p>
    </div>
  );
}

function Tally({
  label,
  value,
  tone = "text-ink",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="card p-3">
      <p className={`text-lg font-bold leading-none ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{label}</p>
    </div>
  );
}
