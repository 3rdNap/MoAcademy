# Working notes for MoAcademy

## Branch workflow (important)

- **Develop on `claude/academy-lms-redesign-txxeo9`.** All work and pushes go to
  this feature branch. Never commit directly on `main`.
- **Stay on the feature branch even after a merge.** Do not `git checkout main`
  to sync. Instead update the local `main` ref without leaving the branch:

  ```bash
  git fetch origin main:main      # fast-forward local main to remote
  git rebase main                 # bring the feature branch up to date (optional)
  ```

  If local `main` ever has stray commits, reset it to the remote without
  checking it out: `git branch -f main origin/main`.
- Push with `git push -u origin claude/academy-lms-redesign-txxeo9`.
- Open a PR (base `main`) only when asked; merge only when asked.

## Verifying changes

The sandbox terminates long-lived server processes, so a live `next start`
smoke test usually isn't possible. Verify instead by:

1. `npm run build` — must compile + lint clean (all routes).
2. Inspect the prerendered HTML under `.next/server/app/**.html` for static
   routes to confirm expected content rendered.
3. Unit-check pure logic (pricing, gradebook math, date helpers) with a small
   `node` script.

Client islands gated on `localStorage`/role (roadmap, billing, instructor
tools, gradebook) only render their content after hydration, so they won't
appear in the static prerender — that's expected, not a bug.

## Architecture conventions

- **Runs with no backend.** Server data comes from `src/lib/data` (Supabase →
  seed fallback). User-owned, editable data persists in the browser via
  `useLocalCollection` (`src/lib/local-store.ts`): roadmap, billing, instructor
  authoring, gradebook. Keys are namespaced `moacademy.*`.
- **Roles** are previewed client-side via `src/components/role` (`RoleProvider`,
  `InstructorOnly`). This maps onto `profiles.role` once Supabase Auth is wired.
- **Supabase migrations** in `supabase/migrations/` mirror the domain model and
  are the path to real, shared, server-side data.
- Shared UI primitives live in `src/components/ui` (Button, Modal, form, Badge,
  Widget, …). Reuse them rather than re-styling.

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
  control (`/api/admin/enroll`). Legacy paid `registrations` are only a fallback;
  the anonymous demo still uses seed courses.
- **Guardians** (`parent` role, migration 0017) are created student-driven at
  signup/creation and linked via `guardian_links`; `/family` shows the linked
  child's enrolled courses.
- Migrations **0017** (guardians) and **0018** (enrolments) must be applied to
  the live DB for these to work; code degrades gracefully (caught errors →
  fallback) until then. Service-role key required for the admin routes.
