-- MoAcademy parent/guardian accounts
--
-- A guardian is a parent who follows their child's progress. The flow is
-- student-driven (see src/app/api/guardians/provision): when a student signs
-- up they enter their guardian's name + email; the server creates a 'parent'
-- account with a temporary password (that the parent changes later) and links
-- it to the student here. Guardians get read-only visibility into the linked
-- student's registrations (→ courses) and submissions (→ grades).
--
-- Apply after 0016. Run with the Supabase CLI (`supabase db push`) or paste
-- into the SQL editor. The app degrades gracefully until this is applied: the
-- provisioning route and family view catch the missing-table error and no-op.

-- 1. 'parent' becomes a valid profile role.
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'instructor', 'admin', 'parent'));

-- 2. Guardian ↔ student links. A guardian may have several children; a student
--    may have several guardians. The pair is unique.
create table if not exists public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (guardian_id, student_id)
);

create index if not exists idx_guardian_links_guardian
  on public.guardian_links (guardian_id);
create index if not exists idx_guardian_links_student
  on public.guardian_links (student_id);

alter table public.guardian_links enable row level security;

-- A guardian reads their own links; a student reads links naming them; admins
-- read all. Writes are service-role only (the provisioning route), so there is
-- no client insert/update/delete policy.
drop policy if exists "guardian reads own links" on public.guardian_links;
create policy "guardian reads own links" on public.guardian_links
  for select to authenticated
  using (auth.uid() = guardian_id or auth.uid() = student_id or private.is_admin());

-- 3. SECURITY DEFINER helper: is the current user a guardian of :student? Kept
--    in the non-API-exposed `private` schema, mirroring private.is_admin().
create or replace function private.is_guardian_of(student uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.guardian_links g
    where g.guardian_id = auth.uid() and g.student_id = student
  );
$$;

revoke execute on function private.is_guardian_of(uuid) from public, anon;
grant execute on function private.is_guardian_of(uuid) to authenticated;

-- 4. Additive read policies: a guardian can read a linked student's profile,
--    registrations, registration items and submissions (all read-only).
drop policy if exists "guardians read linked students" on public.profiles;
create policy "guardians read linked students" on public.profiles
  for select to authenticated using (private.is_guardian_of(id));

drop policy if exists "guardians read student registrations" on public.registrations;
create policy "guardians read student registrations" on public.registrations
  for select to authenticated using (private.is_guardian_of(user_id));

drop policy if exists "guardians read student registration items" on public.registration_items;
create policy "guardians read student registration items" on public.registration_items
  for select to authenticated using (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id and private.is_guardian_of(r.user_id)
    )
  );

drop policy if exists "guardians read student submissions" on public.submissions;
create policy "guardians read student submissions" on public.submissions
  for select to authenticated using (private.is_guardian_of(user_id));
