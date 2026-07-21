-- Awards (D2L "Awards" tool): achievement badges. An instructor mints badges
-- for a course they teach; an admin mints institution-wide badges
-- (course_key null). Badges are awarded to students with an optional note;
-- students display what they've earned, guardians see their child's.
--
-- Apply after 0036. Applied to the live project on 2026-07-13.

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  course_key text,                          -- null = institution-wide (admin)
  name text not null,
  description text not null default '',
  icon text not null default '🏅',          -- an emoji shown on the badge
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_badges_course on public.badges (course_key);

alter table public.badges enable row level security;

-- Badge definitions aren't sensitive; any signed-in user may read them.
drop policy if exists "read badges" on public.badges;
create policy "read badges" on public.badges
  for select to authenticated using (true);

-- Course badges: managed by the course's teaching accounts. Institution
-- badges (course_key null): admins only.
drop policy if exists "manage course badges" on public.badges;
create policy "manage course badges" on public.badges
  for all to authenticated
  using (
    case when course_key is null then private.is_admin()
         else private.teaches_course(course_key) end
  )
  with check (
    case when course_key is null then private.is_admin()
         else private.teaches_course(course_key) end
  );

create table if not exists public.badge_awards (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null references public.badges (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  awarded_by uuid references public.profiles (id) on delete set null,
  note text not null default '',
  awarded_at timestamptz not null default now(),
  unique (badge_id, student_id)
);

create index if not exists idx_badge_awards_student on public.badge_awards (student_id);

alter table public.badge_awards enable row level security;

-- A student sees their own awards; guardians their child's; a teacher sees
-- awards of a badge they own the course for; admins all.
drop policy if exists "read badge awards" on public.badge_awards;
create policy "read badge awards" on public.badge_awards
  for select to authenticated
  using (
    (select auth.uid()) = student_id
    or private.is_guardian_of(student_id)
    or private.is_admin()
    or exists (
      select 1 from public.badges b
      where b.id = badge_id
        and b.course_key is not null
        and private.teaches_course(b.course_key)
    )
  );

-- Awarding: an admin may award any badge; a teacher may award a course badge
-- for a course they teach. (Institution badges are admin-only to award.)
drop policy if exists "grant badge awards" on public.badge_awards;
create policy "grant badge awards" on public.badge_awards
  for all to authenticated
  using (
    private.is_admin()
    or exists (
      select 1 from public.badges b
      where b.id = badge_id
        and b.course_key is not null
        and private.teaches_course(b.course_key)
    )
  )
  with check (
    private.is_admin()
    or exists (
      select 1 from public.badges b
      where b.id = badge_id
        and b.course_key is not null
        and private.teaches_course(b.course_key)
    )
  );
