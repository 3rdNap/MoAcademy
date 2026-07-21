-- Course groups (D2L "Groups" tool): a teaching account partitions its
-- enrolled roster into named groups within a course. Group membership is the
-- foundation for group discussions/assignments and simply for organising a
-- large class. Teachers of the course (private.teaches_course, migration 0030)
-- manage groups and membership; enrolled course-mates can see the groups and
-- their members within that course.
--
-- Apply after 0035. Applied to the live project on 2026-07-13.

create table if not exists public.course_groups (
  id uuid primary key default gen_random_uuid(),
  course_key text not null,
  name text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_course_groups_course
  on public.course_groups (course_key);

alter table public.course_groups enable row level security;

-- Course-mates who share the subject (students + teachers) can see groups;
-- teachers of the course manage them.
drop policy if exists "read course groups" on public.course_groups;
create policy "read course groups" on public.course_groups
  for select to authenticated
  using (
    private.teaches_course(course_key)
    or exists (
      select 1
      from private.subject_code_map m
      join public.subject_enrollments se
        on se.subject_code = m.code and se.user_id = (select auth.uid())
      where m.id = course_key
    )
  );

drop policy if exists "teaching manages course groups" on public.course_groups;
create policy "teaching manages course groups" on public.course_groups
  for all to authenticated
  using (private.teaches_course(course_key))
  with check (private.teaches_course(course_key));

create table if not exists public.group_members (
  group_id uuid not null references public.course_groups (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, student_id)
);

create index if not exists idx_group_members_student
  on public.group_members (student_id);

alter table public.group_members enable row level security;

-- A member sees their own membership rows; a teacher of the group's course
-- sees and manages all of them.
drop policy if exists "read group members" on public.group_members;
create policy "read group members" on public.group_members
  for select to authenticated
  using (
    (select auth.uid()) = student_id
    or exists (
      select 1 from public.course_groups g
      where g.id = group_id and private.teaches_course(g.course_key)
    )
  );

drop policy if exists "teaching manages group members" on public.group_members;
create policy "teaching manages group members" on public.group_members
  for all to authenticated
  using (
    exists (
      select 1 from public.course_groups g
      where g.id = group_id and private.teaches_course(g.course_key)
    )
  )
  with check (
    exists (
      select 1 from public.course_groups g
      where g.id = group_id and private.teaches_course(g.course_key)
    )
  );
