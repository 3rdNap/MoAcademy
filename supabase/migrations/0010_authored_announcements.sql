-- Database-backed instructor announcements.
--
-- Demo courses live in bundled seed data with text ids ("c_cs101"), while
-- courses.id is a uuid — so authored announcements reference the app's course
-- via a course_key text column instead of the uuid FK (which becomes
-- optional, for when real course rows exist). Reads stay public; writes are
-- for teaching roles (instructor/admin).

alter table public.announcements
  alter column course_id drop not null;

alter table public.announcements
  add column if not exists course_key text;

create index if not exists idx_announcements_course_key
  on public.announcements (course_key);

drop policy if exists "teaching write announcements" on public.announcements;
create policy "teaching write announcements" on public.announcements
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
