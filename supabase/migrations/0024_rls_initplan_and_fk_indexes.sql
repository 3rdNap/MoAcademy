-- Performance hygiene, per the Supabase advisors (2026-07-11):
--
-- 1. Every RLS policy that called auth.uid() directly re-evaluated it per row
--    (auth_rls_initplan warnings). Recreate them with (select auth.uid()) so
--    Postgres evaluates it once per statement. Semantics are unchanged — each
--    policy below is the live definition with only that substitution.
-- 2. Cover the foreign keys the advisor flagged as unindexed.
--
-- Apply after 0023. Applied to the live project on 2026-07-11.

-- ---------------------------------------------------------------- indexes --

create index if not exists idx_submissions_user on public.submissions (user_id);
create index if not exists idx_submissions_graded_by on public.submissions (graded_by);
create index if not exists idx_module_item_progress_item on public.module_item_progress (item_id);
create index if not exists idx_discussion_topics_author on public.discussion_topics (author_id);
create index if not exists idx_discussion_replies_author on public.discussion_replies (author_id);
create index if not exists idx_registration_items_subject on public.registration_items (subject_id);

-- --------------------------------------------------------------- profiles --

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for select using ((select auth.uid()) = id);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert with check ((select auth.uid()) = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ------------------------------------------------------------ enrollments --

drop policy if exists "own enrollments" on public.enrollments;
create policy "own enrollments" on public.enrollments
  for select using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- roadmap --

drop policy if exists "own roadmap targets" on public.roadmap_targets;
create policy "own roadmap targets" on public.roadmap_targets
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own roadmap requirements" on public.roadmap_requirements;
create policy "own roadmap requirements" on public.roadmap_requirements
  for all using (
    exists (
      select 1 from public.roadmap_targets t
      where t.id = target_id and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.roadmap_targets t
      where t.id = target_id and t.user_id = (select auth.uid())
    )
  );

drop policy if exists "own roadmap applications" on public.roadmap_applications;
create policy "own roadmap applications" on public.roadmap_applications
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own roadmap scholarships" on public.roadmap_scholarships;
create policy "own roadmap scholarships" on public.roadmap_scholarships
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- billing --

drop policy if exists "own registrations" on public.registrations;
create policy "own registrations" on public.registrations
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own registration items" on public.registration_items;
create policy "own registration items" on public.registration_items
  for all using (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id and r.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.registrations r
      where r.id = registration_id and r.user_id = (select auth.uid())
    )
  );

-- ----------------------------------------------------------- study guides --

drop policy if exists "admins manage study guides" on public.study_guides;
create policy "admins manage study guides" on public.study_guides
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- ------------------------------------------------- teaching write content --

drop policy if exists "teaching write announcements" on public.announcements;
create policy "teaching write announcements" on public.announcements
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

drop policy if exists "teaching write assignments" on public.assignments;
create policy "teaching write assignments" on public.assignments
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

drop policy if exists "teaching write modules" on public.modules;
create policy "teaching write modules" on public.modules
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

drop policy if exists "teaching write module_items" on public.module_items;
create policy "teaching write module_items" on public.module_items
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

-- ------------------------------------------------------------ discussions --

drop policy if exists "post own topics" on public.discussion_topics;
create policy "post own topics" on public.discussion_topics
  for insert to authenticated
  with check (author_id = (select auth.uid()));

drop policy if exists "delete own or moderate topics" on public.discussion_topics;
create policy "delete own or moderate topics" on public.discussion_topics
  for delete to authenticated
  using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('instructor', 'admin')
    )
  );

drop policy if exists "post own replies" on public.discussion_replies;
create policy "post own replies" on public.discussion_replies
  for insert to authenticated
  with check (author_id = (select auth.uid()));

drop policy if exists "delete own or moderate replies" on public.discussion_replies;
create policy "delete own or moderate replies" on public.discussion_replies
  for delete to authenticated
  using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('instructor', 'admin')
    )
  );

-- -------------------------------------------------------------- guardians --

drop policy if exists "guardian reads own links" on public.guardian_links;
create policy "guardian reads own links" on public.guardian_links
  for select to authenticated
  using (
    (select auth.uid()) = guardian_id
    or (select auth.uid()) = student_id
    or private.is_admin()
  );

-- ------------------------------------------------------------- enrolments --

drop policy if exists "read own enrollments" on public.subject_enrollments;
create policy "read own enrollments" on public.subject_enrollments
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or private.is_admin()
    or private.is_guardian_of(user_id)
  );

-- ------------------------------------------------------------ submissions --

drop policy if exists "read own or taught submissions" on public.submissions;
create policy "read own or taught submissions" on public.submissions
  for select to authenticated
  using ((select auth.uid()) = user_id or private.teaches_assignment(assignment_id));

drop policy if exists "insert own or taught submissions" on public.submissions;
create policy "insert own or taught submissions" on public.submissions
  for insert to authenticated
  with check ((select auth.uid()) = user_id or private.teaches_assignment(assignment_id));

drop policy if exists "update own or taught submissions" on public.submissions;
create policy "update own or taught submissions" on public.submissions
  for update to authenticated
  using ((select auth.uid()) = user_id or private.teaches_assignment(assignment_id))
  with check ((select auth.uid()) = user_id or private.teaches_assignment(assignment_id));

-- -------------------------------------------------------- module progress --

drop policy if exists "own progress" on public.module_item_progress;
create policy "own progress" on public.module_item_progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- messages --

drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages" on public.messages
  for select to authenticated
  using ((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id);

drop policy if exists "send as self to allowed recipient" on public.messages;
create policy "send as self to allowed recipient" on public.messages
  for insert to authenticated
  with check ((select auth.uid()) = sender_id and private.can_message(recipient_id));

drop policy if exists "recipient marks read" on public.messages;
create policy "recipient marks read" on public.messages
  for update to authenticated
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);
