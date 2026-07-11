-- Server sync for the remaining personal-planning features: the roadmap's
-- uploaded prospectus fields, personal calendar events, and practice-quiz
-- history. All rows are strictly user-owned.
--
-- Apply after 0024. Applied to the live project on 2026-07-11.

-- 1. The roadmap application type tracks an optionally uploaded prospectus
--    (file name + small data URL); 0002 predates those fields.
alter table public.roadmap_applications
  add column if not exists prospectus_file_name text,
  add column if not exists prospectus_data text;

-- 2. Personal calendar events (the "add event" flow on /calendar).
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id text,
  title text not null,
  at timestamptz not null,
  type text not null default 'event'
    check (type in ('assignment', 'quiz', 'event', 'office_hours')),
  created_at timestamptz not null default now()
);

create index if not exists idx_calendar_events_user on public.calendar_events (user_id);

alter table public.calendar_events enable row level security;

drop policy if exists "own calendar events" on public.calendar_events;
create policy "own calendar events" on public.calendar_events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 3. Practice quiz history (topic + score per attempt).
create table if not exists public.practice_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  topic text not null,
  score int not null,
  total int not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_practice_results_user on public.practice_results (user_id);

alter table public.practice_results enable row level security;

drop policy if exists "own practice results" on public.practice_results;
create policy "own practice results" on public.practice_results
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
