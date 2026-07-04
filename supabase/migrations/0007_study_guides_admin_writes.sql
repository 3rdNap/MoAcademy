-- Study guides are published by admins for everyone: reads stay public,
-- but writes now require profiles.role = 'admin' (previously any owner).
-- Applied to the live project on 2026-07-04.

drop policy if exists "own study guides" on public.study_guides;

create policy "admins manage study guides" on public.study_guides
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
