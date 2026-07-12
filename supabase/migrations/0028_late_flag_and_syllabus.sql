-- Two Canvas-parity pieces:
--
-- 1. Late flagging, enforced in the database (a client-computed flag could be
--    tampered with): whenever a submission lands as 'submitted' after the
--    assignment's due date, its status becomes 'late'. Grading still moves it
--    to 'graded' untouched.
-- 2. Instructor-authored course syllabus, one row per course_key, readable by
--    everyone (like announcements), writable by teaching accounts.
--
-- Apply after 0027. Applied to the live project on 2026-07-11.

create or replace function private.mark_late_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  due timestamptz;
begin
  if new.status = 'submitted' and new.submitted_at is not null then
    select a.due_at into due from public.assignments a where a.id = new.assignment_id;
    if due is not null and new.submitted_at > due then
      new.status := 'late';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_mark_late on public.submissions;
create trigger submissions_mark_late
  before insert or update on public.submissions
  for each row execute function private.mark_late_submission();

-- ---------------------------------------------------------------- syllabus --

create table if not exists public.course_syllabus (
  course_key text primary key,
  body text not null default '',
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.course_syllabus enable row level security;

drop policy if exists "read syllabus" on public.course_syllabus;
create policy "read syllabus" on public.course_syllabus
  for select using (true);

drop policy if exists "teaching write syllabus" on public.course_syllabus;
create policy "teaching write syllabus" on public.course_syllabus
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
