-- MoAcademy University Roadmap schema
-- Backs the feature in src/app/roadmap and src/lib/roadmap. Until these tables
-- are populated, the app stores roadmap data per-student in the browser
-- (localStorage), so the feature works with no backend configured.

-- Target institutions / programmes a student is aiming for.
create table if not exists public.roadmap_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  institution text not null,
  program text not null default '',
  location text,
  priority text not null default 'target' check (priority in ('reach','target','safety')),
  min_aps int,
  target_aps int,
  current_aps int,
  notes text,
  created_at timestamptz not null default now()
);

-- Individual admission requirements, with minimum vs competitive ("safe") bars.
create table if not exists public.roadmap_requirements (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.roadmap_targets (id) on delete cascade,
  label text not null,
  minimum text,
  recommended text,
  met boolean not null default false,
  position int not null default 0
);

-- Application windows + resources per institution.
create table if not exists public.roadmap_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  institution text not null,
  program text,
  opens_at timestamptz,
  closes_at timestamptz,
  apply_url text,
  prospectus_url text,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','submitted','accepted','waitlisted','rejected')),
  notes text,
  created_at timestamptz not null default now()
);

-- Scholarships & bursaries.
create table if not exists public.roadmap_scholarships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  provider text not null default '',
  coverage text,
  closes_at timestamptz,
  url text,
  requirements text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_roadmap_targets_user on public.roadmap_targets (user_id);
create index if not exists idx_roadmap_requirements_target on public.roadmap_requirements (target_id);
create index if not exists idx_roadmap_applications_user on public.roadmap_applications (user_id);
create index if not exists idx_roadmap_scholarships_user on public.roadmap_scholarships (user_id);

-- Row Level Security: each student owns their roadmap rows.
alter table public.roadmap_targets enable row level security;
alter table public.roadmap_requirements enable row level security;
alter table public.roadmap_applications enable row level security;
alter table public.roadmap_scholarships enable row level security;

create policy "own roadmap targets" on public.roadmap_targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own roadmap requirements" on public.roadmap_requirements
  for all using (
    exists (
      select 1 from public.roadmap_targets t
      where t.id = target_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.roadmap_targets t
      where t.id = target_id and t.user_id = auth.uid()
    )
  );

create policy "own roadmap applications" on public.roadmap_applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own roadmap scholarships" on public.roadmap_scholarships
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
