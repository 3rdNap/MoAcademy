"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, RotateCcw, Trophy, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MoMarkIcon } from "@/components/layout/MoMarkIcon";
import { useLocalCollection, newId } from "@/lib/local-store";
import { seedGuides, type StudyGuide } from "@/lib/study-guides";
import type { Registration } from "@/lib/billing/registration";
import type { QuizQuestion } from "@/app/api/quiz/route";
import { cn, formatDate } from "@/lib/utils";

interface QuizResult {
  id: string;
  topic: string;
  score: number;
  total: number;
  createdAt: string;
}

type Stage = "setup" | "loading" | "quiz" | "done";

export function PracticeQuiz() {
  const [stage, setStage] = useState<Stage>("setup");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const history = useLocalCollection<QuizResult>("moacademy.practice.history", []);

  // Topic suggestions from the student's own world: registered subjects and
  // the guides available to them.
  const registrations = useLocalCollection<Registration>(
    "moacademy.billing.registrations",
    [],
  );
  const guides = useLocalCollection<StudyGuide>("moacademy.studyGuides", seedGuides);
  const suggestions = useMemo(() => {
    const subjects = registrations.items.flatMap((r) => r.items.map((i) => i.name));
    const guideTitles = guides.items.map((g) => g.title);
    return [...new Set([...subjects, ...guideTitles])].slice(0, 8);
  }, [registrations.items, guides.items]);

  async function start(chosen?: string) {
    const t = (chosen ?? topic).trim();
    if (!t || stage === "loading") return;
    setTopic(t);
    setError(null);
    setStage("loading");
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t, count }),
      });
      const data = (await res.json().catch(() => null)) as
        | { questions?: QuizQuestion[]; error?: string }
        | null;
      if (!res.ok || !data?.questions?.length) {
        setError(data?.error ?? "Couldn't build the quiz right now.");
        setStage("setup");
        return;
      }
      setQuestions(data.questions);
      setIndex(0);
      setSelected(null);
      setScore(0);
      setStage("quiz");
    } catch {
      setError("Couldn't build the quiz right now.");
      setStage("setup");
    }
  }

  function choose(i: number) {
    if (selected !== null) return;
    setSelected(i);
    if (i === questions[index].answer) setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setSelected(null);
    } else {
      history.add({
        id: newId(),
        topic,
        score,
        total: questions.length,
        createdAt: new Date().toISOString(),
      });
      setStage("done");
    }
  }

  function reset() {
    setStage("setup");
    setQuestions([]);
    setSelected(null);
    setIndex(0);
    setScore(0);
  }

  const q = questions[index];
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Practice"
        subtitle="Mo writes a fresh quiz on any topic — instant marking, with explanations that teach."
      />

      {stage === "setup" && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <MoMarkIcon className="h-8 w-auto shrink-0" />
              <div>
                <h2 className="font-semibold text-ink">What shall we practise?</h2>
                <p className="text-sm text-ink-muted">
                  Pick a subject or type any topic — e.g. “trig identities” or
                  “photosynthesis”.
                </p>
              </div>
            </div>

            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                start();
              }}
            >
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Topic to practise…"
                className="focus-ring w-full rounded-lg border border-black/10 bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint dark:border-white/10"
              />
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                aria-label="Number of questions"
                className="focus-ring shrink-0 rounded-lg border border-black/10 bg-surface px-2 py-2 text-sm text-ink dark:border-white/10"
              >
                <option value={5}>5 Qs</option>
                <option value={8}>8 Qs</option>
                <option value={10}>10 Qs</option>
              </select>
              <Button type="submit" disabled={!topic.trim()}>
                Start
              </Button>
            </form>

            {suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => start(s)}
                    className="focus-ring rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-ink-muted hover:border-brand-300 hover:text-ink dark:border-white/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-500/10">
                {error}
              </p>
            )}
          </div>

          {history.hydrated && history.items.length > 0 && (
            <div className="card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
                Recent quizzes
              </h2>
              <ul className="mt-3 divide-y divide-black/5">
                {history.items.slice(0, 6).map((r) => {
                  const p = Math.round((r.score / r.total) * 100);
                  return (
                    <li key={r.id} className="flex items-center justify-between py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{r.topic}</p>
                        <p className="text-xs text-ink-faint">{formatDate(r.createdAt)}</p>
                      </div>
                      <Badge tone={p >= 70 ? "success" : p >= 40 ? "warning" : "danger"}>
                        {r.score}/{r.total}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {stage === "loading" && (
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-20 text-center">
          <MoMarkIcon className="h-10 w-auto animate-pulse" />
          <p className="text-sm text-ink-muted">
            Mo is writing your quiz on <span className="font-semibold text-ink">{topic}</span>…
          </p>
        </div>
      )}

      {stage === "quiz" && q && (
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 flex items-center justify-between text-xs text-ink-faint">
            <span>
              Question {index + 1} of {questions.length} · {topic}
            </span>
            <span>
              Score {score}/{index + (selected !== null ? 1 : 0)}
            </span>
          </div>
          <div className="card p-6">
            <h2 className="text-base font-semibold leading-relaxed text-ink">{q.q}</h2>
            <div className="mt-4 space-y-2">
              {q.options.map((opt, i) => {
                const isAnswer = i === q.answer;
                const isPicked = i === selected;
                const revealed = selected !== null;
                return (
                  <button
                    key={i}
                    onClick={() => choose(i)}
                    disabled={revealed}
                    className={cn(
                      "focus-ring flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                      !revealed &&
                        "border-black/10 hover:border-brand-300 hover:bg-brand-50/50 dark:border-white/10",
                      revealed && isAnswer &&
                        "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200",
                      revealed && isPicked && !isAnswer &&
                        "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200",
                      revealed && !isPicked && !isAnswer && "border-black/5 opacity-60 dark:border-white/5",
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {revealed && isAnswer && <CheckCircle2 className="h-5 w-5 shrink-0" />}
                    {revealed && isPicked && !isAnswer && <XCircle className="h-5 w-5 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {selected !== null && (
              <div className="mt-4 rounded-xl bg-surface-subtle p-4 text-sm text-ink-muted">
                <p>
                  <span className="font-semibold text-ink">
                    {selected === q.answer ? "Correct! " : "Not quite. "}
                  </span>
                  {q.explain}
                </p>
                <Button onClick={next} className="mt-3">
                  {index + 1 < questions.length ? (
                    <>
                      Next question <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    "See my score"
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="mx-auto max-w-2xl">
          <div className="card flex flex-col items-center gap-4 p-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-500/15">
              <Trophy className="h-7 w-7" />
            </span>
            <div>
              <p className="text-3xl font-bold text-ink">
                {score}/{questions.length}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {pct >= 80
                  ? "Excellent — you own this topic!"
                  : pct >= 50
                    ? "Good work — a little more practice and you've got it."
                    : "Tough one — review the explanations and try again."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => start(topic)}>
                <RotateCcw className="h-4 w-4" /> Same topic again
              </Button>
              <Button variant="outline" onClick={reset}>
                New topic
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
