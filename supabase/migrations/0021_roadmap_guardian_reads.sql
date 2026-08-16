-- MoAcademy roadmap: shared per student, and visible to their guardian
--
-- The University Roadmap tables have existed since 0002 but nothing ever wrote
-- to them — the boards kept everything in the student's own browser. That made
-- the roadmap invisible to a parent asking the obvious question: has my child
-- actually got their university applications in?
--
-- This keeps the student as the only author (a guardian follows, never edits)
-- and adds the guardian read path used by the family Roadmap view.
--
-- Apply after 0020. The app degrades gracefully until then: the boards catch
-- the error and stay on their local copy.

create index if not exists idx_roadmap_applications_user
  on public.roadmap_applications (user_id);
create index if not exists idx_roadmap_targets_user
  on public.roadmap_targets (user_id);
create index if not exists idx_roadmap_scholarships_user
  on public.roadmap_scholarships (user_id);

-- Students own their roadmap outright: 0002's "own roadmap …" policies already
-- cover select/insert/update/delete for auth.uid() = user_id.

-- Guardians read a linked student's applications, targets and scholarships —
-- select only, so nothing here lets a parent add, edit or withdraw anything.
drop policy if exists "guardians read student applications"
  on public.roadmap_applications;
create policy "guardians read student applications" on public.roadmap_applications
  for select to authenticated using (private.is_guardian_of(user_id));

drop policy if exists "guardians read student targets" on public.roadmap_targets;
create policy "guardians read student targets" on public.roadmap_targets
  for select to authenticated using (private.is_guardian_of(user_id));

drop policy if exists "guardians read student scholarships"
  on public.roadmap_scholarships;
create policy "guardians read student scholarships" on public.roadmap_scholarships
  for select to authenticated using (private.is_guardian_of(user_id));
