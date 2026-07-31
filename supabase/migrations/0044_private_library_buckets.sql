-- Lock the textbook and study-guide file buckets to each person's enrolments.
--
-- 0043 scoped the metadata rows, but the files themselves lived in *public*
-- buckets ('study-guides', 'textbook-files') — a file's public URL was a
-- bearer token anyone could open regardless of enrolment. This makes both
-- buckets private and gates downloads (signed URLs, which require SELECT under
-- RLS) to the owner, admins, and people registered for the file's subject.
--
-- The subject is encoded into the object path so the policy can read it:
--   <auth.uid()>/<subjectCode>/<kind>/<uuid>-<filename>
-- (mirrors the submissions bucket, which puts the assignment id in the path).
-- Segment [1] = owner uid, [2] = subject code (e.g. 'MATH'), [3] = kind.
--
-- Forward-compatible: the app now stores object *paths* and mints signed URLs,
-- which works whether the bucket is public or private, so applying this does
-- not create a breakage window. Any pre-existing rows that stored a full
-- public URL keep being served as-is by the app (it only signs bare paths);
-- such old files would 404 once private, but the live project has none yet.
--
-- Apply after 0043. Relies on private.registered_for_subject_code (0043).

-- Flip both buckets private.
update storage.buckets set public = false where id in ('study-guides', 'textbook-files');

-- ---------------------------------------------------------------------------
-- study-guides bucket
-- ---------------------------------------------------------------------------
-- Uploads: only admins publish study guides (mirrors the study_guides table's
-- admin-only manage policy), into their own folder.
drop policy if exists "study guides owner insert" on storage.objects;
create policy "study guides admin insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'study-guides'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.is_admin()
  );

drop policy if exists "study guides owner update" on storage.objects;
create policy "study guides owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'study-guides'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "study guides owner delete" on storage.objects;
create policy "study guides owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'study-guides'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Reads: owner (the publishing admin), any admin, or anyone registered for the
-- file's subject (students who take it / instructors who teach it).
drop policy if exists "study guides read enrolled" on storage.objects;
create policy "study guides read enrolled" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'study-guides'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or private.is_admin()
      or private.registered_for_subject_code((storage.foldername(name))[2])
    )
  );

-- ---------------------------------------------------------------------------
-- textbook-files bucket
-- ---------------------------------------------------------------------------
-- Uploads: teaching roles (instructor/admin) into their own folder — unchanged
-- intent from 0042, but the path now carries the subject code.
drop policy if exists "textbook files teaching insert" on storage.objects;
create policy "textbook files teaching insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'textbook-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('instructor', 'admin')
    )
  );

-- (owner update/delete policies from 0042 are unchanged and still apply.)

-- Reads: owner (the uploading teacher), any admin, or anyone registered for the
-- file's subject.
drop policy if exists "textbook files read enrolled" on storage.objects;
create policy "textbook files read enrolled" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'textbook-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or private.is_admin()
      or private.registered_for_subject_code((storage.foldername(name))[2])
    )
  );
