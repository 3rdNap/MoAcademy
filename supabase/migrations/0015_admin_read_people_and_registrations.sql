-- Let admins read all profiles and registrations for the Admin console.
-- A SECURITY DEFINER helper avoids infinite recursion (a profiles policy that
-- queries profiles would recurse); the function reads the role bypassing RLS.
-- Applied to the live project on 2026-07-09.

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Additive SELECT policies (OR'd with the existing own-row policies): an admin
-- can read everyone's profile and every registration.
drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
  for select to authenticated using (public.is_admin());

drop policy if exists "admins read all registrations" on public.registrations;
create policy "admins read all registrations" on public.registrations
  for select to authenticated using (public.is_admin());

drop policy if exists "admins read all registration items" on public.registration_items;
create policy "admins read all registration items" on public.registration_items
  for select to authenticated using (public.is_admin());
