# Working notes for MoAcademy

## Branch workflow (important)

- **Develop on the session's designated `claude/*` feature branch** (currently
  `claude/superbases-connected-migrations-n8mdm2`). Never commit directly on
  `main`.
- **Stay on the feature branch even after a merge.** Do not `git checkout main`
  to sync. Instead update the local `main` ref without leaving the branch:

  ```bash
  git fetch origin main:main      # fast-forward local main to remote
  git rebase main                 # bring the feature branch up to date (optional)
  ```

  If local `main` ever has stray commits, reset it to the remote without
  checking it out: `git branch -f main origin/main`.
- Push with `git push -u origin <feature-branch>`.
- Open a PR (base `main`) only when asked; merge only when asked.

## Verifying changes

The sandbox terminates long-lived server processes, so a live `next start`
smoke test usually isn't possible. Verify instead by:

1. `npm run build` — must compile + lint clean (all routes).
2. Inspect the prerendered HTML under `.next/server/app/**.html` for static
   routes to confirm expected content rendered.
3. Unit-check pure logic (pricing, gradebook math, date helpers) with a small
   `node` script.

Client islands gated on `localStorage`/role only render their content after
hydration, so they won't appear in the static prerender — that's expected,
not a bug.

## Architecture conventions

- **Supabase-first with graceful degradation.** Server data comes from
  `src/lib/data` (Supabase → seed fallback); every query is wrapped so an
  error/missing backend degrades to the bundled demo instead of breaking the
  page. Signed-in users see only their real data; anonymous visitors get the
  seeded demo.
- **Real, shared server data** (Supabase, applied through migration 0025):
  courses/enrolments (`subject_enrollments`), instructor-authored
  announcements/assignments/modules (keyed by `course_key` = the subject id,
  e.g. `sub_math`), discussions, study guides, **submissions + gradebook**
  (0019/0020: students turn in work, teaching accounts grade their real
  roster, field-level trigger separates student vs. teacher columns),
  **messages** (0021: course-mates and admins; recipient-only, column-limited
  `read_at` updates), guardians (0017).
- **Browser-side data modules** live in `src/lib/*-db.ts`
  (`course-content-db`, `discussions-db`, `gradebook-db`, `inbox-db`,
  `study-guides-db`): browser Supabase client, every function returns
  null/false on any error so components fall back to the local demo store.
- **User-owned personal data syncs server-side too** (migration 0025):
  roadmap targets/applications/scholarships, personal calendar events,
  practice-quiz history. Boards run a dual path — remote state when signed
  in, browser-local for the anonymous demo — with a one-time ref-guarded
  import of pre-existing local data into an empty account that must
  exclude the bundled seed rows (`useLocalCollection` persists its seed
  defaults even for untouched visitors, so filter by seed ids).
- **Still browser-local only** via `useLocalCollection`
  (`src/lib/local-store.ts`, keys `moacademy.*`): the demo fallbacks.
- **Self-service billing/payments is removed** (PayFast checkout, billing
  dashboard, pay-to-register): `/billing` is an informational office notice;
  study guides scope by `subject_enrollments`. `src/lib/billing/` keeps the
  subject catalogue, pricing helpers (admin revenue display), CURRENT_TERM
  fallback and demo types; admin console keeps registration history. The
  server-side legacy fallback (paid registrations → courses) remains as an
  invisible compat path.
- **RLS helper convention:** security-definer helpers live in the
  non-API-exposed `private` schema (`is_admin`, `is_guardian_of`,
  `teaches_assignment`, `teaches_student`, `shares_subject_with`,
  `can_message`, plus the `subject_code_map` lookup bridging subject *id*
  (`sub_math`, used as `course_key`) ↔ subject *code* (`MATH`, used in
  `subject_enrollments.subject_code`)). Note that id≠code — map via
  `subjects` in `src/lib/billing/subjects.ts` client-side.
- **Roles** are previewed client-side via `src/components/role`
  (`RoleProvider`, `InstructorOnly`) and are authoritative from
  `profiles.role` for signed-in users.
- Shared UI primitives live in `src/components/ui` (Button, Modal, form,
  Badge, Widget, …). Reuse them rather than re-styling.

## Institutional model (auth & enrolment)

The app runs as an institution, not a self-service signup:

- **No public self-signup.** `/signup` is an informational notice; accounts are
  admin-issued. The admin console's "Add person" (`/api/admin/create-user`,
  service-role) generates a `name@moacademy.com` login + temporary password and
  sets the role. The address is a **login identity, not a real mailbox**.
- **First-login password change.** New accounts carry
  `user_metadata.must_change_password`; `src/lib/supabase/middleware.ts` funnels
  them to `/account/set-password` until they set their own password.
- **Enrolment is admin-driven.** A signed-in student's courses come from
  `subject_enrollments` (migration 0018), assigned via the console's "Subjects"
  control (`/api/admin/enroll`). Legacy paid `registrations` are only a
  fallback; the anonymous demo still uses seed courses. Instructor-role
  enrolment rows double as teaching assignments (they drive gradebook access,
  rosters, and instructor names on courses).
- **Visibility:** course-mates (anyone sharing a subject+term enrolment) can
  see each other's profiles/enrolments and message each other; teaching
  accounts see and grade their enrolled roster; guardians get read-only access
  to their linked child's courses, submissions and grades; admins see all.
- **Guardians** (`parent` role, migration 0017) are created student-driven at
  signup/creation and linked via `guardian_links`; `/family` shows the linked
  child's enrolled courses and grade rollups.
- **The active term is admin-managed** (app_settings key `current_term`,
  migration 0029; console "Term:" control) — `CURRENT_TERM` is only the
  fallback. Weighted assignment groups (0029) drive gradebook totals when
  an instructor gives groups weight; plain points math otherwise.
- **Attendance + timetables** (migration 0030): per-course attendance
  registers (teaching accounts of the subject write via
  `private.teaches_course`; students/guardians read their own) and weekly
  `course_meetings` slots surfaced on the course home and expanded into
  calendar occurrences client-side.
- **Rubrics + structured quizzes** (0031/0032/0035): point-valued rubric
  criteria with per-student awards; quizzes support MCQ (answer keys in a
  teacher-only table) **and** written-response questions, with an
  attempts-allowed limit (best auto-score counts). Grading runs in the
  `submit_quiz_attempt` SECURITY DEFINER RPC (scaled to assignment points,
  lands as a graded submission via a transaction-local guard escape; when
  written questions exist it lands as `submitted` for teacher grading). The
  submissions field guard covers INSERT as well as UPDATE.
- **Module item content** (0034): items hold a page body, an uploaded file
  (public `course-files` bucket, teaching-role writes), or a link/video, and
  every item is click-through.
- **Clickable course tools** — each course has tabs for Home, Syllabus,
  Modules, Assignments, Discussions, Grades, People, Attendance, Groups
  (0036), Awards (0037), Surveys (0038), Insights, and Office hours (0033,
  book/cancel via row-locked RPCs). Groups/Awards/Surveys follow the same
  board pattern: a `src/lib/*-db.ts` module + a `[courseId]/<tab>` route +
  a `Course*Board` with a `useRole`/`canTeach` split, real-mode gated on
  `fetchCourseRoster` non-null.
- **Surveys anonymity** (0038): the `submit_survey` RPC writes answers with
  `respondent_id` NULL for anonymous surveys (no answer↔student link exists
  even for the teacher); `survey_completions` tracks who responded for
  dedupe/progress without that link.
- **Admin console** (D2L operations model): People (roles, passwords,
  add/import), **bulk CSV import** (`/api/admin/bulk-import`, shared
  provisioning helpers in `src/lib/admin/provision.ts`), Enrollments by
  subject, Reports & processes (CSV exports), Term control. The admin
  dashboard shows active-user/course/alert/message tiles + an operations
  grid (`getAdminDashboard`, `getAdminEnrollments`).
- All migrations through **0038** are applied to the live Supabase project
  (private `submissions` bucket + public `course-files` bucket). Admin
  console can reset a forgotten password (`/api/admin/reset-password`,
  service-role); the new temp password re-flags `must_change_password`.
- **Known-intentional security advisors:** the `submit_quiz_attempt`,
  `submit_survey`, `book_office_hour`, `cancel_office_hour` RPCs are
  signed-in-callable SECURITY DEFINER by design (each authenticates the
  caller and scopes its writes). Leaked-password protection is a Supabase
  dashboard toggle (Auth), not code.
  (`lzrwzjawwsjhmesavgzr`). Code still degrades gracefully (caught errors →
  fallback). Service-role key required for the admin routes.
