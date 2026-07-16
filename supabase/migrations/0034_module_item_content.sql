-- Module items become real content, not just labeled rows: a page body, an
-- external/video URL, or an uploaded file. The 'course-files' bucket is
-- public-read (course content is public in the app model, like study guides);
-- writes require a teaching role and land in the uploader's own folder.
--
-- Apply after 0033. Applied to the live project on 2026-07-12.

alter table public.module_items
  add column if not exists body text not null default '',
  add column if not exists url text,
  add column if not exists file_path text;

insert into storage.buckets (id, name, public)
values ('course-files', 'course-files', true)
on conflict (id) do nothing;

drop policy if exists "course files teaching insert" on storage.objects;
create policy "course files teaching insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'course-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('instructor', 'admin')
    )
  );

drop policy if exists "course files teaching update" on storage.objects;
create policy "course files teaching update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'course-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "course files teaching delete" on storage.objects;
create policy "course files teaching delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'course-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
