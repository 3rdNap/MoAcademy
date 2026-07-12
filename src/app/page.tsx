import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Compass,
  GraduationCap,
  Library,
  Sparkles,
  Users,
} from "lucide-react";

export const metadata = {
  title: "MoAcademy — Smart Learning",
};

const FEATURES = [
  {
    icon: BookOpen,
    title: "Courses that feel familiar",
    body: "A blend of Canvas and Brightspace: course cards, modules, assignments, discussions, gradebook and announcements — all in one calm interface.",
  },
  {
    icon: Sparkles,
    title: "Mo, your AI tutor",
    body: "Ask anything, any time. Mo knows your courses and study guides, explains step by step, quizzes you, and searches the web when you need fresh facts.",
  },
  {
    icon: Library,
    title: "Study guides for your subjects",
    body: "Curated PDF guides with thumbnails, matched to the subjects you're enrolled in — no clutter from subjects you don't take.",
  },
  {
    icon: Compass,
    title: "University roadmap",
    body: "Track target institutions with the marks that actually guarantee a space, application dates and portals, plus scholarships and bursaries.",
  },
  {
    icon: Users,
    title: "Parents stay in the loop",
    body: "A family dashboard shows each child's average, course progress, upcoming deadlines and recent grades at a glance.",
  },
  {
    icon: GraduationCap,
    title: "Run by the academy",
    body: "Accounts and subjects are set up by the academy office, so you sign in to exactly the courses you're enrolled in — nothing to configure.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mo-mark.png" alt="mo" className="h-7 w-auto" />
          <span aria-hidden className="h-9 w-px bg-ink/70" />
          <span className="flex flex-col justify-center gap-[3px] font-display">
            <span className="text-xl font-extrabold leading-none tracking-tight">
              ACADEMY
            </span>
            <span className="text-[6px] font-medium uppercase leading-none tracking-[0.34em] text-ink-muted">
              Smart Learning
            </span>
          </span>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="focus-ring rounded-lg px-3 py-2 text-sm font-semibold text-ink-muted hover:text-ink"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="focus-ring rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 text-center sm:px-6 sm:pt-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mo-mark.png" alt="" className="mx-auto h-16 w-auto sm:h-20" />
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Smart Learning for every student
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-ink-muted sm:text-lg">
          MoAcademy brings your courses, study guides, university plans and an
          AI tutor named Mo into one place — built for students, instructors
          and parents.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="focus-ring inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard"
            className="focus-ring inline-flex items-center gap-2 rounded-xl border border-black/10 px-6 py-3 text-sm font-semibold text-ink hover:bg-surface-subtle dark:border-white/10"
          >
            Explore the app
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-black/5 bg-surface-subtle/50 p-5 dark:border-white/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-500/15">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-3 text-base font-bold">{f.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                  {f.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Closing teaser */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-brand-950 px-6 py-10 text-center text-white sm:px-10">
          <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Your subjects, all in one place.
          </h2>
          <p className="max-w-xl text-sm text-brand-200 sm:text-base">
            The academy office enrols you in your subjects — then everything you
            need, from course content to study guides, is waiting when you sign
            in.
          </p>
          <Link
            href="/courses"
            className="focus-ring mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-950 hover:bg-brand-50"
          >
            Explore courses <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 py-8 text-center text-xs text-ink-faint dark:border-white/5">
        <p className="font-display font-semibold tracking-[0.28em]">
          MOACADEMY · SMART LEARNING
        </p>
        <p className="mt-1 tracking-[0.28em]">ESTD 2026</p>
      </footer>
    </div>
  );
}
