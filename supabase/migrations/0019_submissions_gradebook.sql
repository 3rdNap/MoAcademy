-- Real submissions + gradebook, replacing the browser-local "Turn in" demo
-- and the fake-roster gradebook (src/lib/roster.ts). Students manage their
-- own submission content; instructors of a subject can grade their real
-- enrolled roster. Mirrors the private.* helper convention from 0016/0017.
--
-- Apply after 0018.

-- 1. Richer submission content + grading metadata.
alter table public.submissions
  add column if not exists body text not null default '',
  add column if not exists file_name text,
  add column if not exists feedback text,
  add column if not exists graded_at timestamptz,
  add column if not exists graded_by uuid references public.profiles (id);

-- 2. assignments.course_key (migration 0011) stores the Subject *id*
--    (e.g. "sub_math"), while subject_enrollments.subject_code (0018) stores
--    the Subject *code* (e.g. "MATH") — see src/lib/billing/subjects.ts. This
--    static lookup bridges the two inside security-definer helpers only; it
--    is never exposed via the API (private schema, no client grants).
create table if not exists private.subject_code_map (
  id text primary key,
  code text not null unique
);

insert into private.subject_code_map (id, code) values
  ('sub_math', 'MATH'),
  ('sub_physci', 'PHSC'),
  ('sub_lifesci', 'LFSC'),
  ('sub_it', 'INFT'),
  ('sub_mathlit', 'MLIT'),
  ('sub_english', 'ENGL'),
  ('sub_afrikaans', 'AFRK'),
  ('sub_accounting', 'ACCT'),
  ('sub_economics', 'ECON'),
  ('sub_business', 'BSTD'),
  ('sub_geography', 'GEOG'),
  ('sub_history', 'HIST')
on conflict (id) do update set code = excluded.code;

-- 3. Does the current user teach the course this assignment belongs to?
create or replace function private.teaches_assignment(aid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select private.is_admin() or exists (
    select 1
    from public.assignments a
    join private.subject_code_map m on m.id = a.course_key
    join public.subject_enrollments se
      on se.subject_code = m.code and se.role = 'instructor'
    where a.id = aid and se.user_id = auth.uid()
  );
$$;

revoke execute on function private.teaches_assignment(uuid) from public, anon;
grant execute on function private.teaches_assignment(uuid) to authenticated;

-- 4. Does the current user teach a given student (shares a subject/term
--    where the caller is the instructor and the student is enrolled)?
create or replace function private.teaches_student(student uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select private.is_admin() or exists (
    select 1
    from public.subject_enrollments s
    join public.subject_enrollments i
      on i.subject_code = s.subject_code and i.term = s.term and i.role = 'instructor'
    where s.user_id = student and s.role = 'student' and i.user_id = auth.uid()
  );
$$;

revoke execute on function private.teaches_student(uuid) from public, anon;
grant execute on function private.teaches_student(uuid) to authenticated;

-- 5. Field-level guard: a student may only edit their own submission's
--    content; only the teaching account may set grading fields. RLS alone
--    can't split permissions by column within one row, so this is enforced
--    in a trigger.
create or replace function private.guard_submission_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.teaches_assignment(new.assignment_id) then
    new.body := old.body;
    new.file_name := old.file_name;
    new.submitted_at := old.submitted_at;
  else
    if new.score is distinct from old.score
      or new.feedback is distinct from old.feedback
      or new.graded_at is distinct from old.graded_at
      or new.graded_by is distinct from old.graded_by
    then
      raise exception 'only the teaching account can grade a submission';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_guard_update on public.submissions;
create trigger submissions_guard_update
  before update on public.submissions
  for each row execute function private.guard_submission_update();

-- 6. Submissions RLS: own row, or the teaching account, or a linked guardian
--    (guardian read policy already exists from 0017 — kept, not duplicated).
drop policy if exists "own submissions" on public.submissions;
drop policy if exists "read own or taught submissions" on public.submissions;
create policy "read own or taught submissions" on public.submissions
  for select to authenticated
  using (auth.uid() = user_id or private.teaches_assignment(assignment_id));

drop policy if exists "students insert own submission" on public.submissions;
create policy "students insert own submission" on public.submissions
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update own or taught submissions" on public.submissions;
create policy "update own or taught submissions" on public.submissions
  for update to authenticated
  using (auth.uid() = user_id or private.teaches_assignment(assignment_id))
  with check (auth.uid() = user_id or private.teaches_assignment(assignment_id));

-- 7. Instructors can see their real roster: enrolment rows and profiles of
--    students enrolled in a subject they teach.
drop policy if exists "instructors read roster enrollments" on public.subject_enrollments;
create policy "instructors read roster enrollments" on public.subject_enrollments
  for select to authenticated
  using (role = 'student' and private.teaches_student(user_id));

drop policy if exists "instructors read roster profiles" on public.profiles;
create policy "instructors read roster profiles" on public.profiles
  for select to authenticated
  using (private.teaches_student(id));
