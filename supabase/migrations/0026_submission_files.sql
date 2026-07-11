-- Real file attachments on assignment submissions.
--
-- A private 'submissions' bucket (student work must not be publicly
-- readable — unlike study guides, downloads go through signed URLs, which
-- require SELECT under RLS). Uploads land at
-- `<auth.uid()>/<assignmentId>/<uuid>-<filename>`, so the first path segment
-- ties the object to its owner and the second lets the teaching-side read
-- policy reuse private.teaches_assignment().
--
-- Apply after 0025. Applied to the live project on 2026-07-11.

insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

drop policy if exists "submission files owner insert" on storage.objects;
create policy "submission files owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "submission files owner update" on storage.objects;
create policy "submission files owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "submission files owner delete" on storage.objects;
create policy "submission files owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Owners re-download their own work; teaching accounts (and admins, via the
-- helper) read submissions for assignments they teach.
drop policy if exists "submission files read own or taught" on storage.objects;
create policy "submission files read own or taught" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or private.teaches_assignment(((storage.foldername(name))[2])::uuid)
    )
  );

-- The submission row records where its attachment lives.
alter table public.submissions
  add column if not exists file_path text;
