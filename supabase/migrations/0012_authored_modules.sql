-- Database-backed instructor modules + items, completing the authored-content
-- trio (0010 announcements, 0011 assignments): modules reference the app's
-- course via course_key text; module_items ride on their module's FK. Reads
-- stay public; writes require a teaching role.
-- Applied to the live project on 2026-07-05.

alter table public.modules
  alter column course_id drop not null;

alter table public.modules
  add column if not exists course_key text;

create index if not exists idx_modules_course_key
  on public.modules (course_key);

drop policy if exists "teaching write modules" on public.modules;
create policy "teaching write modules" on public.modules
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

drop policy if exists "teaching write module_items" on public.module_items;
create policy "teaching write module_items" on public.module_items
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
