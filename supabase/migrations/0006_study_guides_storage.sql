-- MoAcademy study-guide Storage bucket
-- Creates the public 'study-guides' bucket used by src/lib/supabase/storage.ts
-- and scopes writes to each user's own folder. Public buckets serve objects via
-- their public URL without a SELECT policy, so none is added (this also stops
-- clients from listing/enumerating the bucket).

insert into storage.buckets (id, name, public)
values ('study-guides', 'study-guides', true)
on conflict (id) do nothing;

-- Uploads land at `<auth.uid()>/<pdf|thumb>/<uuid>-<filename>`, so the first
-- path segment must match the signed-in user.
drop policy if exists "study guides owner insert" on storage.objects;
create policy "study guides owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'study-guides'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "study guides owner update" on storage.objects;
create policy "study guides owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'study-guides'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "study guides owner delete" on storage.objects;
create policy "study guides owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'study-guides'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
