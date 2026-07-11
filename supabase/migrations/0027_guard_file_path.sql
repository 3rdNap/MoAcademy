-- 0026 added submissions.file_path as student-owned content; include it in
-- the field-level guard's teaching branch so a teacher-side update can never
-- clobber the student's attachment (mirrors body/file_name/submitted_at).
--
-- Apply after 0026. Applied to the live project on 2026-07-11.

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
    new.file_path := old.file_path;
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
