-- Admins can read every enrolment row directly (the console's writes already
-- go through the service role; this covers ordinary reads like resolving each
-- subject's instructor for the catalogue view).
--
-- Apply after 0021. Applied to the live project on 2026-07-11.

drop policy if exists "admins read all enrollments" on public.subject_enrollments;
create policy "admins read all enrollments" on public.subject_enrollments
  for select to authenticated
  using (private.is_admin());
