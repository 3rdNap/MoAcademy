"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Widget } from "@/components/ui/Widget";
import { Button } from "@/components/ui/Button";
import { MoMarkIcon } from "@/components/layout/MoMarkIcon";
import { useLocalCollection } from "@/lib/local-store";
import type { Registration } from "@/lib/billing/registration";
import type { PlanDay } from "@/app/api/plan/route";
import type { Assignment, Course } from "@/lib/types";
import { relativeTime } from "@/lib/utils";

const PLAN_KEY = "moacademy.studyplan";

interface StoredPlan {
  generatedAt: string;
  days: PlanDay[];
}

interface QuizResult {
  id: string;
  topic: string;
  score: number;
  total: number;
  createdAt: string;
}

/**
 * "Mo's study plan" — a 7-day plan built from the student's real deadlines,
 * registered subjects and practice-quiz weak spots. Generated on demand and
 * kept in the browser until refreshed.
 */
export function StudyPlanWidget({
  upcoming,
  courses,
}: {
  upcoming: Assignment[];
  courses: Course[];
}) {
  const [plan, setPlan] = useState<StoredPlan | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PLAN_KEY);
      if (raw) setPlan(JSON.parse(raw) as StoredPlan);
    } catch {
      /* start fresh */
    }
    setHydrated(true);
  }, []);

  const registrations = useLocalCollection<Registration>(
    "moacademy.billing.registrations",
    [],
  );
  const history = useLocalCollection<QuizResult>("moacademy.practice.history", []);

  const subjects = useMemo(
    () => [...new Set(registrations.items.flatMap((r) => r.items.map((i) => i.name)))],
    [registrations.items],
  );
  // Topics averaging under 70% across recent quizzes need revision.
  const weakTopics = useMemo(() => {
    const byTopic = new Map<string, { score: number; total: number }>();
    for (const r of history.items.slice(0, 20)) {
      const t = byTopic.get(r.topic) ?? { score: 0, total: 0 };
      t.score += r.score;
      t.total += r.total;
      byTopic.set(r.topic, t);
    }
    return [...byTopic.entries()]
      .map(([topic, t]) => ({ topic, pct: Math.round((t.score / t.total) * 100) }))
      .filter((w) => w.pct < 70)
      .sort((a, b) => a.pct - b.pct);
  }, [history.items]);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deadlines: upcoming.slice(0, 10).map((a) => ({
            title: a.title,
            course: courses.find((c) => c.id === a.courseId)?.code ?? "",
            dueAt: a.dueAt,
            points: a.points,
          })),
          subjects,
          weakTopics,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { days?: PlanDay[]; error?: string }
        | null;
      if (!res.ok || !data?.days?.length) {
        setError(data?.error ?? "Couldn't build the plan right now.");
        return;
      }
      const stored: StoredPlan = {
        generatedAt: new Date().toISOString(),
        days: data.days,
      };
      setPlan(stored);
      setExpanded(true);
      try {
        window.localStorage.setItem(PLAN_KEY, JSON.stringify(stored));
      } catch {
        /* in-memory only */
      }
    } catch {
      setError("Couldn't build the plan right now.");
    } finally {
      setBusy(false);
    }
  }

  if (!hydrated) return null;

  return (
    <Widget
      title="Mo's study plan"
      icon={<MoMarkIcon className="h-4 w-auto" />}
      action={
        plan ? (
          <button
            onClick={generate}
            disabled={busy}
            className="focus-ring inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" /> {busy ? "Planning…" : "Refresh"}
          </button>
        ) : undefined
      }
    >
      {!plan ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-sm text-ink-muted">
            Mo can plan your week around your real deadlines
            {weakTopics.length > 0 && " — and the topics your quizzes say need work"}
            .
          </p>
          <Button size="sm" onClick={generate} disabled={busy}>
            {busy ? "Planning…" : "Plan my week"}
          </Button>
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
      ) : (
        <div>
          <ol className="space-y-3">
            {(expanded ? plan.days : plan.days.slice(0, 3)).map((d) => (
              <li key={d.day}>
                <p className="text-sm font-semibold text-ink">
                  {d.day}{" "}
                  <span className="font-normal text-ink-faint">· {d.focus}</span>
                </p>
                <ul className="mt-1 space-y-0.5">
                  {d.tasks.map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm text-ink-muted">
                      <span className="text-brand-400">•</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="focus-ring text-xs font-medium text-brand-600 hover:underline"
            >
              {expanded ? "Show less" : `Show all ${plan.days.length} days`}
            </button>
            <span className="text-[11px] text-ink-faint">
              Planned {relativeTime(plan.generatedAt)}
            </span>
          </div>
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        </div>
      )}
    </Widget>
  );
}
