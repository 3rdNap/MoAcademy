-- MoAcademy initial schema
-- Mirrors the domain model in src/lib/types.ts. Apply with the Supabase CLI
-- (`supabase db push`) or paste into the SQL editor. The app runs on bundled
-- seed data until these tables are populated.

create extension if not exists "pgcrypto";

-- Profiles extend Supabase auth.users with LMS-specific fields.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'student' check (role in ('student', 'instructor', 'admin')),
  avatar_color text not null default '#5d3fea',
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  short_name text not null,
  term text not null,
  description text not null default '',
  color text not null default '#5d3fea',
  instructor text not null,
  credits int not null default 3,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'instructor', 'ta')),
  progress int not null default 0 check (progress between 0 and 100),
  unique (course_id, user_id)
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  position int not null default 0,
  published boolean not null default false
);

create table if not exists public.module_items (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  title text not null,
  type text not null check (type in ('page','assignment','quiz','discussion','file','link','video')),
  position int not null default 0,
  due_at timestamptz,
  duration_min int,
  indent int not null default 0
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  type text not null default 'assignment' check (type in ('assignment','quiz','discussion')),
  description text not null default '',
  due_at timestamptz not null,
  available_at timestamptz,
  points int not null default 100
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','submitted','graded','late','missing')),
  score int,
  submitted_at timestamptz,
  unique (assignment_id, user_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  author text not null,
  body text not null default '',
  posted_at timestamptz not null default now()
);

-- Helpful indexes for the access patterns used by the app.
create index if not exists idx_modules_course on public.modules (course_id);
create index if not exists idx_module_items_module on public.module_items (module_id);
create index if not exists idx_assignments_course on public.assignments (course_id);
create index if not exists idx_announcements_course on public.announcements (course_id);
create index if not exists idx_enrollments_user on public.enrollments (user_id);

-- Row Level Security: enable and add baseline read policies. Tighten these to
-- enrollment-scoped access before going to production.
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.modules enable row level security;
alter table public.module_items enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.announcements enable row level security;

create policy "read courses" on public.courses for select using (true);
create policy "read modules" on public.modules for select using (true);
create policy "read module_items" on public.module_items for select using (true);
create policy "read assignments" on public.assignments for select using (true);
create policy "read announcements" on public.announcements for select using (true);
create policy "own profile" on public.profiles for select using (auth.uid() = id);
create policy "own enrollments" on public.enrollments for select using (auth.uid() = user_id);
create policy "own submissions" on public.submissions for select using (auth.uid() = user_id);
