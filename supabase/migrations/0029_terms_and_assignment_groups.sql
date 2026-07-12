-- Term management + weighted assignment groups.
--
-- 1. app_settings: institution-wide key/value config, starting with the
--    active term (was the hardcoded CURRENT_TERM constant). Everyone reads;
--    admins write directly under RLS (no service role needed).
-- 2. assignment_groups: Canvas-style weighted grading buckets per course
--    (e.g. Homework 40 / Exams 60). Weight is a percentage; groups are
--    teaching-managed like the rest of authored course content.
--
-- Apply after 0028. Applied to the live project on 2026-07-12.

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('current_term', 'Fall 2026')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "read app settings" on public.app_settings;
create policy "read app settings" on public.app_settings
  for select using (true);

drop policy if exists "admins write app settings" on public.app_settings;
create policy "admins write app settings" on public.app_settings
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ------------------------------------------------------ assignment groups --

create table if not exists public.assignment_groups (
  id uuid primary key default gen_random_uuid(),
  course_key text not null,
  name text not null,
  weight int not null default 0 check (weight between 0 and 100),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_assignment_groups_course
  on public.assignment_groups (course_key);

alter table public.assignment_groups enable row level security;

drop policy if exists "read assignment groups" on public.assignment_groups;
create policy "read assignment groups" on public.assignment_groups
  for select using (true);

drop policy if exists "teaching write assignment groups" on public.assignment_groups;
create policy "teaching write assignment groups" on public.assignment_groups
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('instructor', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('instructor', 'admin')
    )
  );

-- Deleting a group ungroups its assignments rather than deleting them.
alter table public.assignments
  add column if not exists group_id uuid references public.assignment_groups (id) on delete set null;

create index if not exists idx_assignments_group on public.assignments (group_id);
