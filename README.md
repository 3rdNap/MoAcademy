<p align="center">
  <img src="public/logo-lockup.png" alt="MoAcademy — Smart Learning" width="440" />
</p>

# MoAcademy

**Smart Learning.** A full **institutional Learning Management System** built with
Next.js, TypeScript, Tailwind CSS, and Supabase, modelled on **D2L Brightspace**
and **Canvas**. MoAcademy runs as a school, not a self-service signup: an admin
office issues accounts and enrols people, instructors teach and assess, students
learn, and guardians follow along.

- **Canvas-style global rail** (Dashboard, Courses, Calendar, Inbox, …) with
  colourful course cards, and **Brightspace-style homepage widgets** and a
  top-bar course switcher.
- **Role-catered dashboards** — a student, instructor, admin, and parent each
  get a home built for what they actually do (no shared/generic view).
- **Per-course tools:** Home · Syllabus · Modules · Assignments · Discussions ·
  Grades · People · Attendance · Groups · Awards · Surveys · Insights ·
  Office hours.

> The app runs **out-of-the-box on bundled seed data** — no backend required, so
> anonymous visitors always see a working demo. Add Supabase credentials for
> real accounts and shared data, and an `ANTHROPIC_API_KEY` to switch on **Mo**,
> the AI layer (tutor chat, practice quizzes, study plans, authoring assists,
> early-warning check-ins).

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Tech stack

| Layer      | Choice                                            |
| ---------- | ------------------------------------------------- |
| Framework  | Next.js 15 (App Router, React Server Components)  |
| Language   | TypeScript                                        |
| Styling    | Tailwind CSS + a custom `brand` design token set  |
| Icons      | lucide-react                                      |
| Backend    | Supabase (Postgres + Auth + Storage) — optional   |
| AI         | Claude via the Anthropic API — optional           |

## Configuration

Copy `.env.example` to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...        # live accounts + shared data
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...       # admin provisioning (create user, reset password, bulk import, enrol)
ANTHROPIC_API_KEY=...               # Mo, the AI layer
# optional: ASSISTANT_MODEL=claude-fable-5
```

Every capability degrades gracefully: with no Supabase env the app serves the
bundled demo; without the service-role key the admin provisioning actions show
a "not configured" note; without the Anthropic key every Mo surface renders a
friendly disabled state. Visit **`/api/status`** on any deployment to see which
of `supabase` / `roleManagement` / `assistant` are live.

Apply the SQL in `supabase/migrations/` in order (Supabase SQL editor or
`supabase db push`) — the schema spans `0001`–`0040`. Then, in the Supabase
dashboard, enable **Auth → Leaked Password Protection** (the one hardening step
that isn't code). `supabase/tests/security_invariants.sql` is a roll-back-only
script that re-verifies the security-critical RLS/RPC guards after any migration.

## Operating the institution

The setup sequence for a live deployment:

1. **Create the first admin.** Sign a user up (or insert a `profiles` row) and
   set their `role` to `admin`. Admins are authoritative from `profiles.role`.
2. **Add people.** Admin console (`/admin`) → **Add person** issues a
   `name@moacademy.com` login + temporary password, or **Import people** takes a
   `name,role,subjects` CSV and provisions a whole cohort at once (credentials
   returned for distribution). The address is a **login identity, not a mailbox**.
3. **Enrol subjects.** Each person's **Subjects** control assigns their subjects
   for the active term. Instructor-role enrolments double as teaching
   assignments — they drive gradebook access, rosters, and instructor names.
4. **Set the term.** The **Term** control advances the active semester
   (`app_settings.current_term`); enrolments are per-term, so old terms remain
   as history.

New accounts carry `must_change_password` and are funnelled to
`/account/set-password` on first sign-in. Admins can reset any forgotten
password from the console.

## Roles

Roles are authoritative from `profiles.role` for signed-in users; the anonymous
demo previews roles via a top-bar switcher (`src/components/role/`).

- **Student** — enrolled courses, coursework, grades, report card, planning
  tools (Roadmap, Practice), calendar, inbox.
- **Instructor** — a teaching dashboard with a **needs-grading queue**, their
  taught courses, and full authoring/assessment inside each course.
- **Admin** — a Brightspace-style operations dashboard (active users, courses
  per term, system health, unread messages) and the console: people, roles,
  passwords, bulk import, enrolments by subject, reports (CSV), term control.
- **Parent/guardian** — a read-only family portal of their linked child's
  courses, grades, attendance, and a printable report card.

## Course tools

Each course (`/courses/[id]`) carries the full Brightspace-style toolset, with a
`useRole`/`canTeach` split — teaching accounts author, everyone else consumes:

- **Modules** — content items that hold a page, an uploaded file
  (`course-files` bucket), or a link/video; every item is click-through, with
  per-student completion tracking.
- **Assignments** — files/text submissions to a private bucket (signed-URL
  downloads), weighted **assignment groups**, **rubrics** (criterion grading),
  late-flagging, feedback, and a CSV grade export.
- **Quizzes** — MCQ (answer keys in a teacher-only table) **and** written
  questions, multiple attempts, auto-graded server-side by the
  `submit_quiz_attempt` RPC; import questions from any quiz you teach.
- **Discussions** — threaded topics and nested replies.
- **Attendance** — per-date registers (present/absent/late/excused) with term
  rates; **Office hours** — instructor slots students book (row-locked RPCs).
- **Groups**, **Awards** (badges), **Surveys** (anonymous, with honest
  DB-level unlinking), and **Insights** (Mo's early-warning dashboard).

## Mo — the AI layer

**Mo** is MoAcademy's AI, powered by **Claude** (`claude-opus-4-8` default; set
`ASSISTANT_MODEL=claude-fable-5` for the top tier). One server-side
`ANTHROPIC_API_KEY` switches on the whole suite; the key never reaches the
browser.

- **Study Assistant** — a streaming tutor chat grounded in the student's real
  courses, deadlines and study guides, with optional web search.
- **Practice** — fresh MCQ quizzes on any topic, marked instantly.
- **Study plan** — a 7-day plan from real deadlines and quiz weak spots.
- **Insights + check-ins** — instructors see per-student risk (grades, missing
  work, attendance) and have Mo draft a warm outreach message.
- **Family digest** — a plain-language recap of a child's week for guardians.
- **Draft with Mo** — assignment/announcement text from a title.

## Personal planning (student-owned, server-synced)

- **University Roadmap** — target institutions/programmes with min-vs-competitive
  admission bars, application windows, and scholarships.
- **Study Guides** — a subject-tagged PDF library, scoped to the student's
  enrolments; admins upload.
- Practice history and personal calendar events sync per account too.

## Scheduled automation (Intelligent Agents)

`pg_cron` runs nightly agents that message students in-app (from their
instructor) about upcoming and overdue unsubmitted work, deduped per
assignment. Admins toggle agents and read the run log in the console
(`automation_agents` / `automation_log`, migration 0039).

## Architecture notes

- **Supabase-first with graceful degradation** — server data comes from
  `src/lib/data`; every query falls back to bundled seed on error/missing
  backend. Browser-side data modules (`src/lib/*-db.ts`) return null/false on
  error so components degrade to the local demo.
- **RLS everywhere** — security-definer helpers live in a non-API `private`
  schema (`is_admin`, `is_guardian_of`, `teaches_course`, `teaches_assignment`,
  `shares_subject_with`, `can_message`, …). A field-level trigger separates
  student-owned submission columns from grading columns; sensitive writes
  (quiz grading, survey submission, office-hours booking) go through
  SECURITY DEFINER RPCs.
- See `CLAUDE.md` for the working conventions and the full model.

## Project structure

```
src/
  app/(app)/               Routed pages under the nav chrome
    dashboard/ courses/ courses/[courseId]/{modules,assignments,grades,
      discussions,people,attendance,groups,awards,surveys,insights,
      syllabus,office-hours}
    admin/ family/ report/ calendar/ inbox/ grades/ roadmap/ practice/
      study-guides/ assistant/ account/
    api/                   chat, quiz, plan, generate, admin/*, guardians, status
  components/              layout, dashboard, courses, admin, family, role, ui, …
  lib/
    data/                  Server data-access layer (Supabase → seed) + seed
    *-db.ts                Browser data modules (gradebook, quiz, groups, …)
    supabase/  billing/  roadmap/  admin/  types.ts  nav.ts  role.ts
supabase/
  migrations/0001–0040     Schema, RLS, RPCs, storage buckets, pg_cron
  tests/security_invariants.sql
```
