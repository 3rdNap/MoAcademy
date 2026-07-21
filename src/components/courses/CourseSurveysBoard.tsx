"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchCourseRoster, type RosterStudent } from "@/lib/gradebook-db";
import {
  addSurveyQuestion,
  createSurvey,
  fetchCourseSurveys,
  fetchMyCompletions,
  fetchSurveyAnswers,
  fetchSurveyCompletionCount,
  fetchSurveyQuestions,
  removeSurvey,
  removeSurveyQuestion,
  submitSurvey,
  type Survey,
  type SurveyQuestion,
} from "@/lib/surveys-db";
import type { Course } from "@/lib/types";

const RATINGS = [1, 2, 3, 4, 5] as const;

function isClosed(s: Survey): boolean {
  return !!s.closesAt && new Date(s.closesAt).getTime() < Date.now();
}

export function CourseSurveysBoard({ course }: { course: Course }) {
  const { role, hydrated } = useRole();
  const teaching = hydrated && canTeach(role);

  if (!hydrated) {
    return (
      <>
        <PageHeader title="Surveys" subtitle={`Surveys in ${course.code}.`} />
        <div className="card p-6 text-sm text-ink-muted">Loading…</div>
      </>
    );
  }
  if (!teaching) return <StudentSurveys course={course} />;
  return <InstructorSurveys course={course} />;
}

/* --------------------------- Instructor view ---------------------------- */

function InstructorSurveys({ course }: { course: Course }) {
  const [roster, setRoster] = useState<
    RosterStudent[] | null | undefined
  >(undefined);
  const [surveys, setSurveys] = useState<Survey[] | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // New-survey form.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [closesAt, setClosesAt] = useState("");

  useEffect(() => {
    let alive = true;
    fetchCourseRoster(course.id).then((r) => alive && setRoster(r));
    fetchCourseSurveys(course.id).then((s) => alive && setSurveys(s ?? []));
    return () => {
      alive = false;
    };
  }, [course.id]);

  // Real mode requires a signed-in teaching account for this subject.
  if (roster === undefined || surveys === undefined) {
    return (
      <>
        <PageHeader title="Surveys" subtitle={`Surveys in ${course.code}.`} />
        <div className="card p-6 text-sm text-ink-muted">Loading surveys…</div>
      </>
    );
  }
  if (roster === null) {
    return (
      <>
        <PageHeader title="Surveys" subtitle={`Surveys in ${course.code}.`} />
        <div className="card flex flex-col items-start gap-2 p-6">
          <p className="font-semibold text-ink">Sign in to manage surveys</p>
          <p className="text-sm text-ink-muted">
            Surveys need a signed-in teaching account for this subject. Once
            you&apos;re signed in as this course&apos;s instructor, you can
            author feedback surveys and read the results here.
          </p>
        </div>
      </>
    );
  }

  async function handleCreate() {
    const t = title.trim();
    if (!t) return;
    setNote(null);
    const created = await createSurvey(course.id, {
      title: t,
      description: description.trim(),
      anonymous,
      closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
    });
    if (!created) {
      setNote("Couldn't create the survey — a teaching account is required.");
      return;
    }
    setSurveys((prev) => [created, ...(prev ?? [])]);
    setSelectedId(created.id);
    setTitle("");
    setDescription("");
    setAnonymous(true);
    setClosesAt("");
  }

  async function handleDelete(id: string) {
    const previous = surveys!;
    setSurveys((prev) => (prev ?? []).filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
    const ok = await removeSurvey(id);
    if (!ok) {
      setSurveys(previous);
      setNote("Couldn't delete the survey.");
    }
  }

  const selected = surveys.find((s) => s.id === selectedId) ?? null;

  return (
    <>
      <PageHeader
        title="Surveys"
        subtitle={`${surveys.length} survey${surveys.length === 1 ? "" : "s"} in ${course.code}. Author feedback surveys and read the results.`}
      />

      <div className="card mb-4 flex flex-col gap-3 p-4">
        <p className="text-sm font-semibold text-ink">New survey</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Title" className="w-64">
            <Input
              value={title}
              placeholder="e.g. Mid-term feedback"
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Closes (optional)" className="w-52">
            <Input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Description" className="w-full">
          <Textarea
            value={description}
            placeholder="What is this survey about?"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-4 w-4 rounded border-black/20"
          />
          Anonymous — responses are not linked to a student, even for you
        </label>
        <div>
          <Button onClick={handleCreate} disabled={!title.trim()}>
            Create survey
          </Button>
        </div>
      </div>

      {note && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {note}
        </p>
      )}

      {surveys.length === 0 ? (
        <div className="card p-6 text-sm text-ink-muted">
          No surveys yet. Create one above to start collecting feedback.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {surveys.map((s) => (
            <div key={s.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{s.title}</span>
                <Badge tone={s.anonymous ? "info" : "neutral"}>
                  {s.anonymous ? "Anonymous" : "Named"}
                </Badge>
                {isClosed(s) && <Badge tone="warning">Closed</Badge>}
                <span className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedId(selectedId === s.id ? null : s.id)
                  }
                >
                  {selectedId === s.id ? "Hide" : "Manage & results"}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(s.id)}
                >
                  Delete
                </Button>
              </div>
              {s.description && (
                <p className="mt-1 text-sm text-ink-muted">{s.description}</p>
              )}
              {selectedId === s.id && selected && (
                <SurveyManager survey={selected} />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Question editor + results for one survey (teaching account). */
function SurveyManager({ survey }: { survey: Survey }) {
  const [questions, setQuestions] = useState<SurveyQuestion[] | undefined>(
    undefined,
  );
  const [answers, setAnswers] = useState<
    { questionId: string; value: string }[] | undefined
  >(undefined);
  const [count, setCount] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Add-question form.
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<"rating" | "text">("rating");

  async function reload() {
    const [q, a, c] = await Promise.all([
      fetchSurveyQuestions(survey.id),
      fetchSurveyAnswers(survey.id),
      fetchSurveyCompletionCount(survey.id),
    ]);
    setQuestions(q ?? []);
    setAnswers(a ?? []);
    setCount(c);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const [q, a, c] = await Promise.all([
        fetchSurveyQuestions(survey.id),
        fetchSurveyAnswers(survey.id),
        fetchSurveyCompletionCount(survey.id),
      ]);
      if (!alive) return;
      setQuestions(q ?? []);
      setAnswers(a ?? []);
      setCount(c);
    })();
    return () => {
      alive = false;
    };
  }, [survey.id]);

  // Group answers by question for the results view.
  const answersByQuestion = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of answers ?? []) {
      const arr = m.get(a.questionId) ?? [];
      arr.push(a.value);
      m.set(a.questionId, arr);
    }
    return m;
  }, [answers]);

  async function handleAdd() {
    const p = prompt.trim();
    if (!p) return;
    setNote(null);
    const created = await addSurveyQuestion(survey.id, {
      prompt: p,
      kind,
      position: (questions?.length ?? 0) + 1,
    });
    if (!created) {
      setNote("Couldn't add the question.");
      return;
    }
    setQuestions((prev) => [...(prev ?? []), created]);
    setPrompt("");
  }

  async function handleRemoveQuestion(id: string) {
    const previous = questions!;
    setQuestions((prev) => (prev ?? []).filter((q) => q.id !== id));
    const ok = await removeSurveyQuestion(id);
    if (!ok) {
      setQuestions(previous);
      setNote("Couldn't delete the question.");
      return;
    }
    // Answers cascade server-side; refresh the results view.
    void reload();
  }

  if (questions === undefined) {
    return (
      <p className="mt-3 border-t border-black/5 pt-3 text-sm text-ink-muted">
        Loading…
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-4 border-t border-black/5 pt-3">
      {note && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {note}
        </p>
      )}

      {/* Questions editor */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Questions</p>
        {questions.length === 0 ? (
          <p className="text-xs text-ink-faint">No questions yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {questions.map((q) => (
              <li key={q.id} className="flex items-center gap-2">
                <Badge tone={q.kind === "rating" ? "brand" : "neutral"}>
                  {q.kind === "rating" ? "1–5" : "Text"}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {q.prompt}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveQuestion(q.id)}
                  aria-label={`Delete question ${q.prompt}`}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="Add question" className="min-w-[16rem] flex-1">
            <Input
              value={prompt}
              placeholder="e.g. How clear were the lectures?"
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
          </Field>
          <div className="flex overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
            {(["rating", "text"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={
                  "px-3 py-2 text-xs font-medium transition-colors " +
                  (kind === k
                    ? "bg-brand-600 text-white"
                    : "bg-surface text-ink-muted hover:bg-surface-subtle")
                }
              >
                {k === "rating" ? "Rating 1–5" : "Text"}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={handleAdd} disabled={!prompt.trim()}>
            Add
          </Button>
        </div>
      </div>

      {/* Results */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-sm font-semibold text-ink">Results</p>
          <Badge tone="neutral">
            {count ?? 0} response{count === 1 ? "" : "s"}
          </Badge>
        </div>
        {questions.length === 0 || (count ?? 0) === 0 ? (
          <p className="text-xs text-ink-faint">
            No responses yet — results appear as students complete the survey.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {questions.map((q) => (
              <li key={q.id}>
                <p className="mb-1.5 text-sm font-medium text-ink">
                  {q.prompt}
                </p>
                {q.kind === "rating" ? (
                  <RatingResult values={answersByQuestion.get(q.id) ?? []} />
                ) : (
                  <TextResult values={answersByQuestion.get(q.id) ?? []} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** A rating question's average plus a per-star distribution. Bar widths scale
 * to the busiest bucket so the shape reads at a glance; the raw count sits
 * alongside each bar. */
function RatingResult({ values }: { values: string[] }) {
  const nums = values
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
  const counts = RATINGS.map((r) => nums.filter((n) => n === r).length);
  const total = nums.length;
  const max = Math.max(1, ...counts);
  const avg = total ? nums.reduce((a, b) => a + b, 0) / total : 0;

  if (total === 0) {
    return <p className="text-xs text-ink-faint">No ratings.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-ink-muted">
        Average <span className="font-semibold text-ink">{avg.toFixed(1)}</span>{" "}
        / 5 across {total} rating{total === 1 ? "" : "s"}
      </p>
      {RATINGS.map((r, i) => (
        <div key={r} className="flex items-center gap-2">
          <span className="w-4 text-right text-xs text-ink-faint">{r}</span>
          <ProgressBar value={(counts[i] / max) * 100} className="flex-1" />
          <span className="w-6 text-right text-xs text-ink-muted">
            {counts[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A text question's free-text answers. Anonymous surveys carry no identity, so
 * this is intentionally just the list of texts. */
function TextResult({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <p className="text-xs text-ink-faint">No answers.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {values.map((v, i) => (
        <li
          key={i}
          className="rounded-lg bg-surface-subtle px-3 py-2 text-sm text-ink"
        >
          {v}
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------- Student view ----------------------------- */

function StudentSurveys({ course }: { course: Course }) {
  const [state, setState] = useState<
    { surveys: Survey[]; completed: Set<string> } | null | undefined
  >(undefined);
  const [taking, setTaking] = useState<Survey | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Anonymous visitors have no surveys (RLS is authenticated-only) and no
      // local demo — surface a friendly sign-in card instead.
      const supabase = createSupabaseBrowserClient();
      let uid: string | null = null;
      if (supabase) {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          uid = user?.id ?? null;
        } catch {
          /* ignore */
        }
      }
      if (!supabase || !uid) {
        if (alive) setState(null);
        return;
      }
      const surveys = await fetchCourseSurveys(course.id);
      if (!alive) return;
      if (surveys === null) {
        setState(null);
        return;
      }
      const done = await fetchMyCompletions(surveys.map((s) => s.id));
      if (!alive) return;
      setState({ surveys, completed: new Set(done ?? []) });
    })();
    return () => {
      alive = false;
    };
  }, [course.id]);

  if (state === undefined) {
    return (
      <>
        <PageHeader title="Surveys" subtitle={`Surveys in ${course.code}.`} />
        <div className="card p-6 text-sm text-ink-muted">Loading…</div>
      </>
    );
  }

  if (state === null) {
    return (
      <>
        <PageHeader title="Surveys" subtitle={`Surveys in ${course.code}.`} />
        <div className="card flex flex-col items-start gap-2 p-6">
          <p className="font-semibold text-ink">Sign in to take surveys</p>
          <p className="text-sm text-ink-muted">
            Your instructor may ask for feedback through surveys. Sign in to see
            and respond to the surveys for this course.
          </p>
        </div>
      </>
    );
  }

  function markCompleted(id: string) {
    setState((prev) =>
      prev
        ? { ...prev, completed: new Set([...prev.completed, id]) }
        : prev,
    );
  }

  const { surveys, completed } = state;

  return (
    <>
      <PageHeader title="Surveys" subtitle={`Surveys in ${course.code}.`} />
      {surveys.length === 0 ? (
        <div className="card p-6 text-sm text-ink-muted">
          No surveys right now. When your instructor opens one, it&apos;ll
          appear here.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {surveys.map((s) => {
            const done = completed.has(s.id);
            const closed = isClosed(s);
            return (
              <div
                key={s.id}
                className="card flex flex-wrap items-center gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{s.title}</span>
                    <Badge tone={s.anonymous ? "info" : "neutral"}>
                      {s.anonymous ? "Anonymous" : "Named"}
                    </Badge>
                  </div>
                  {s.description && (
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {s.description}
                    </p>
                  )}
                </div>
                {done ? (
                  <Badge tone="success">Completed ✓</Badge>
                ) : closed ? (
                  <Button variant="outline" size="sm" disabled>
                    Closed
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setTaking(s)}>
                    Take survey
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {taking && (
        <TakeSurveyModal
          survey={taking}
          onClose={() => setTaking(null)}
          onDone={(id) => {
            markCompleted(id);
            setTaking(null);
          }}
        />
      )}
    </>
  );
}

function TakeSurveyModal({
  survey,
  onClose,
  onDone,
}: {
  survey: Survey;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const [questions, setQuestions] = useState<SurveyQuestion[] | undefined>(
    undefined,
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSurveyQuestions(survey.id).then(
      (q) => alive && setQuestions(q ?? []),
    );
    return () => {
      alive = false;
    };
  }, [survey.id]);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    const ok = await submitSurvey(survey.id, answers);
    setBusy(false);
    if (!ok) {
      setError(
        "Couldn't submit — you may have already responded, or the survey is closed.",
      );
      return;
    }
    onDone(survey.id);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={survey.title}
      description={survey.description || undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={busy || questions === undefined}
          >
            {busy ? "Submitting…" : "Submit"}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-ink-muted">
        {survey.anonymous
          ? "Responses are anonymous — your name is not linked to your answers."
          : "Your name is visible to your instructor."}
      </p>
      {questions === undefined ? (
        <p className="text-sm text-ink-muted">Loading questions…</p>
      ) : questions.length === 0 ? (
        <p className="text-sm text-ink-muted">
          This survey has no questions yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {questions.map((q) => (
            <li key={q.id}>
              <p className="mb-1.5 text-sm font-medium text-ink">{q.prompt}</p>
              {q.kind === "rating" ? (
                <div className="flex gap-1.5">
                  {RATINGS.map((r) => {
                    const active = answers[q.id] === String(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [q.id]: String(r) }))
                        }
                        aria-pressed={active}
                        className={
                          "h-9 w-9 rounded-lg border text-sm font-semibold transition-colors " +
                          (active
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-black/10 bg-surface text-ink-muted hover:bg-surface-subtle dark:border-white/10")
                        }
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Textarea
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  placeholder="Your answer"
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}
    </Modal>
  );
}
