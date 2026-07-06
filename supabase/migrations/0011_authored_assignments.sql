-- Database-backed instructor assignments, mirroring migration 0010 for
-- announcements: authored rows reference the app's course via course_key
-- (text) since demo courses use text ids; course_id (uuid FK) becomes
-- optional. Reads stay public; writes require a teaching role.
-- Applied to the live project on 2026-07-05.

alter table public.assignments
  alter column course_id drop not null;

alter table public.assignments
  add column if not exists course_key text;

create index if not exists idx_assignments_course_key
  on public.assignments (course_key);

drop policy if exists "teaching write assignments" on public.assignments;
create policy "teaching write assignments" on public.assignments
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
