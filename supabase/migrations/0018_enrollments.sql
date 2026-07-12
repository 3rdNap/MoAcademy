-- MoAcademy institutional enrolments
--
-- In the institutional model the admin enrols people into subjects directly —
-- students no longer self-register-and-pay to get their courses. This table is
-- the source of truth for "who is in which subject". Subjects are catalogued in
-- code (src/lib/billing/subjects.ts), so rows key on the subject `code` (text),
-- matching how registration_items already reference subjects.
--
-- Apply after 0017. Run with the Supabase CLI or paste into the SQL editor.
-- The app degrades gracefully until applied (missing-table errors are caught
-- and fall back to the previous registration-derived courses).

create table if not exists public.subject_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_code text not null,
  role text not null default 'student' check (role in ('student', 'instructor')),
  term text not null default 'Fall 2026',
  created_at timestamptz not null default now(),
  unique (user_id, subject_code, role, term)
);

create index if not exists idx_subject_enrollments_user
  on public.subject_enrollments (user_id);

alter table public.subject_enrollments enable row level security;

-- A user reads their own enrolments; guardians read their linked students';
-- admins read all. Writes are admin-only (the enrol route uses the service
-- role, but an explicit admin policy also allows direct SQL management).
drop policy if exists "read own enrollments" on public.subject_enrollments;
create policy "read own enrollments" on public.subject_enrollments
  for select to authenticated
  using (
    auth.uid() = user_id
    or private.is_admin()
    or private.is_guardian_of(user_id)
  );

drop policy if exists "admins manage enrollments" on public.subject_enrollments;
create policy "admins manage enrollments" on public.subject_enrollments
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());
