-- MoAcademy submissions: let students actually submit, and let guardians see it
--
-- public.submissions has existed since 0001 and 0017 already lets a guardian
-- read their linked student's rows — but there has never been an INSERT or
-- UPDATE policy, so nothing could be written and the assignment board kept
-- submissions in the student's own browser instead. A parent on their own
-- device therefore had no way to know whether work had been handed in.
--
-- This adds the write side, with the grading columns held back from students:
-- handing work in is theirs, deciding a mark is not.
--
-- Apply after 0019. The app degrades gracefully until then (writes fail and
-- the board falls back to its local copy).

-- Carry the student's actual answer, so the submission is the work and not
-- just a flag. Attachments keep the storage-path convention used by guides.
alter table public.submissions
  add column if not exists body text not null default '',
  add column if not exists attachment_name text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_submissions_user on public.submissions (user_id);
create index if not exists idx_submissions_assignment
  on public.submissions (assignment_id);

-- A student writes their own row, and may keep revising it until it is graded.
-- `status` is restricted to the pre-grade values and `score` must stay null, so
-- nobody can mark their own work by writing straight to the API.
drop policy if exists "students submit own work" on public.submissions;
create policy "students submit own work" on public.submissions
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and status in ('not_started', 'in_progress', 'submitted')
    and score is null
  );

drop policy if exists "students revise until graded" on public.submissions;
create policy "students revise until graded" on public.submissions
  for update to authenticated
  using (auth.uid() = user_id and status <> 'graded')
  with check (
    auth.uid() = user_id
    and status in ('not_started', 'in_progress', 'submitted')
    and score is null
  );

-- Instructors and admins mark work: they may read and write every submission.
drop policy if exists "teaching assess submissions" on public.submissions;
create policy "teaching assess submissions" on public.submissions
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('instructor', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('instructor', 'admin')
    )
  );

-- Note on why there is no column-level GRANT here: `authenticated` is the same
-- database role for students and instructors alike, so revoking UPDATE on
-- `score` to protect it from students would equally stop instructors marking.
-- The separation is the WITH CHECK above — a student's write must satisfy the
-- student policy (score null, pre-grade status), and only a teaching account
-- can satisfy the policy that permits anything else.

-- Guardians already read their student's submissions (0017); re-assert it here
-- so this migration is self-contained if 0017 is ever rebuilt.
drop policy if exists "guardians read student submissions" on public.submissions;
create policy "guardians read student submissions" on public.submissions
  for select to authenticated using (private.is_guardian_of(user_id));
