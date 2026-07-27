-- Fix: creating a group or survey failed for a signed-in instructor with
-- "permission denied for table subject_code_map".
--
-- Root cause: the read policies on course_groups, surveys and survey_questions
-- checked the enrolled-student case with an INLINE join to
-- private.subject_code_map. Policy expressions evaluate as the invoking role
-- (authenticated), which has no privilege on that private table — so any
-- statement that triggers the SELECT policy (notably INSERT ... RETURNING,
-- which supabase-js always issues via .insert().select()) was denied. The
-- teacher branch worked because private.teaches_course is SECURITY DEFINER.
--
-- Fix: wrap the enrolled-student check in a SECURITY DEFINER helper (mirroring
-- teaches_course) so the map stays fully private, and rewrite the three read
-- policies to use it. Verified by re-running the instructor end-to-end battery.
--
-- Apply after 0040. Applied to the live project on 2026-07-13.

create or replace function private.enrolled_in_course(ck text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from private.subject_code_map m
    join public.subject_enrollments se
      on se.subject_code = m.code and se.user_id = auth.uid()
    where m.id = ck
  );
$$;

revoke execute on function private.enrolled_in_course(text) from public, anon;
grant execute on function private.enrolled_in_course(text) to authenticated;

drop policy if exists "read course groups" on public.course_groups;
create policy "read course groups" on public.course_groups
  for select to authenticated
  using (
    private.teaches_course(course_key)
    or private.enrolled_in_course(course_key)
  );

drop policy if exists "read course surveys" on public.surveys;
create policy "read course surveys" on public.surveys
  for select to authenticated
  using (
    private.teaches_course(course_key)
    or private.enrolled_in_course(course_key)
  );

drop policy if exists "read survey questions" on public.survey_questions;
create policy "read survey questions" on public.survey_questions
  for select to authenticated
  using (
    exists (
      select 1 from public.surveys s
      where s.id = survey_id
        and (
          private.teaches_course(s.course_key)
          or private.enrolled_in_course(s.course_key)
        )
    )
  );
