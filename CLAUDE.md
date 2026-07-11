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
  (`src/lib/local-store.ts`, keys `moacademy.*`): billing/registrations
  (legacy — superseded by admin-driven enrolment) and all demo fallbacks.
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
- All migrations through **0025** are applied to the live Supabase project
  (`lzrwzjawwsjhmesavgzr`). Code still degrades gracefully (caught errors →
  fallback). Service-role key required for the admin routes.
