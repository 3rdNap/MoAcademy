"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Award, Compass, FileText } from "lucide-react";
import { Widget } from "@/components/ui/Widget";
import { Badge } from "@/components/ui/Badge";
import { useLocalCollection } from "@/lib/local-store";
import {
  fetchRemoteApplications,
  fetchRemoteScholarships,
} from "@/lib/roadmap-db";
import { seedApplications, seedScholarships } from "@/lib/roadmap/seed";
import { deadlineState } from "@/lib/roadmap/deadline";
import { formatDate } from "@/lib/utils";
import type { ApplicationEntry, Scholarship } from "@/lib/roadmap/types";

interface Deadline {
  id: string;
  kind: "application" | "scholarship";
  title: string;
  subtitle: string;
  closesAt: string;
}

/** Pulls the soonest upcoming application & scholarship deadlines from the
 *  student's roadmap (stored in the browser) onto the dashboard. */
export function RoadmapDeadlinesWidget() {
  const apps = useLocalCollection<ApplicationEntry>(
    "moacademy.roadmap.applications",
    seedApplications,
  );
  const scholarships = useLocalCollection<Scholarship>(
    "moacademy.roadmap.scholarships",
    seedScholarships,
  );

  // Signed-in students' deadlines come from Supabase; anonymous stays local.
  const [remoteApps, setRemoteApps] = useState<ApplicationEntry[] | null>(null);
  const [remoteScholarships, setRemoteScholarships] = useState<
    Scholarship[] | null
  >(null);
  useEffect(() => {
    let alive = true;
    fetchRemoteApplications().then((r) => alive && setRemoteApps(r));
    fetchRemoteScholarships().then((r) => alive && setRemoteScholarships(r));
    return () => {
      alive = false;
    };
  }, []);

  const appItems = remoteApps ?? apps.items;
  const scholarshipItems = remoteScholarships ?? scholarships.items;

  const deadlines: Deadline[] = [
    ...appItems
      .filter((a) => a.closesAt)
      .map((a) => ({
        id: a.id,
        kind: "application" as const,
        title: a.institution,
        subtitle: a.program ?? "Application",
        closesAt: a.closesAt!,
      })),
    ...scholarshipItems
      .filter((s) => s.closesAt)
      .map((s) => ({
        id: s.id,
        kind: "scholarship" as const,
        title: s.name,
        subtitle: s.provider,
        closesAt: s.closesAt!,
      })),
  ]
    .filter((d) => !deadlineState(d.closesAt).closed)
    .sort((a, b) => +new Date(a.closesAt) - +new Date(b.closesAt))
    .slice(0, 5);

  return (
    <Widget
      title="Roadmap deadlines"
      icon={<Compass className="h-4 w-4 text-brand-600" />}
      action={
        <Link
          href="/roadmap/applications"
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          Open roadmap
        </Link>
      }
      bodyClassName="pt-1"
    >
      {deadlines.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-faint">
          No upcoming application or scholarship deadlines.
        </p>
      ) : (
        <ul className="divide-y divide-black/5">
          {deadlines.map((d) => {
            const dl = deadlineState(d.closesAt);
            const Icon = d.kind === "application" ? FileText : Award;
            return (
              <li key={`${d.kind}-${d.id}`}>
                <Link
                  href={
                    d.kind === "application"
                      ? "/roadmap/applications"
                      : "/roadmap/scholarships"
                  }
                  className="flex items-center gap-3 py-2.5 hover:bg-surface-subtle"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {d.title}
                    </p>
                    <p className="truncate text-xs text-ink-faint">
                      {d.subtitle} · {formatDate(d.closesAt)}
                    </p>
                  </div>
                  <Badge tone={dl.tone}>{dl.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}
