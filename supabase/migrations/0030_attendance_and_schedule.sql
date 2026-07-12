-- Attendance registers + weekly course schedules.
--
-- 1. private.teaches_course(course_key): does the caller teach this course
--    this term (or admin)? Course-level sibling of teaches_assignment —
--    bridges course_key (subject id) to subject_code via the private map.
-- 2. attendance: one row per student/course/date, marked by the teaching
--    account. Students read their own; guardians read their child's; the
--    teaching side reads/writes its subject's register.
-- 3. course_meetings: weekly timetable slots per course (weekday + times),
--    readable by everyone, teaching-managed like other authored content.
--
-- Apply after 0029. Applied to the live project on 2026-07-12.

create or replace function private.teaches_course(ck text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select private.is_admin() or exists (
    select 1
    from private.subject_code_map m
    join public.subject_enrollments se
      on se.subject_code = m.code and se.role = 'instructor'
    where m.id = ck and se.user_id = auth.uid()
  );
$$;

revoke execute on function private.teaches_course(text) from public, anon;
grant execute on function private.teaches_course(text) to authenticated;

-- --------------------------------------------------------------- attendance

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  course_key text not null,
  student_id uuid not null references public.profiles (id) on delete cascade,
  on_date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  noted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (course_key, student_id, on_date)
);

create index if not exists idx_attendance_student on public.attendance (student_id);
create index if not exists idx_attendance_course_date on public.attendance (course_key, on_date);
create index if not exists idx_attendance_noted_by on public.attendance (noted_by);

alter table public.attendance enable row level security;

drop policy if exists "read own or taught attendance" on public.attendance;
create policy "read own or taught attendance" on public.attendance
  for select to authenticated
  using (
    (select auth.uid()) = student_id
    or private.teaches_course(course_key)
    or private.is_guardian_of(student_id)
  );

drop policy if exists "teaching writes attendance" on public.attendance;
create policy "teaching writes attendance" on public.attendance
  for all to authenticated
  using (private.teaches_course(course_key))
  with check (private.teaches_course(course_key));

-- ---------------------------------------------------------- course meetings

create table if not exists public.course_meetings (
  id uuid primary key default gen_random_uuid(),
  course_key text not null,
  weekday int not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  location text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_course_meetings_course on public.course_meetings (course_key);

alter table public.course_meetings enable row level security;

drop policy if exists "read course meetings" on public.course_meetings;
create policy "read course meetings" on public.course_meetings
  for select using (true);

drop policy if exists "teaching writes course meetings" on public.course_meetings;
create policy "teaching writes course meetings" on public.course_meetings
  for all to authenticated
  using (private.teaches_course(course_key))
  with check (private.teaches_course(course_key));
