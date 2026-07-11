-- Let a teaching account create a placeholder submission row when grading a
-- student who hasn't submitted through the app yet (e.g. a 0 for missing
-- work). Without this, grading a "missing" submission would silently no-op:
-- an UPDATE with no matching row affects nothing but isn't an error.
--
-- Apply after 0019. Applied to the live project on 2026-07-11.

drop policy if exists "students insert own submission" on public.submissions;
drop policy if exists "insert own or taught submissions" on public.submissions;
create policy "insert own or taught submissions" on public.submissions
  for insert to authenticated
  with check (auth.uid() = user_id or private.teaches_assignment(assignment_id));
