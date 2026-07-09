-- Move is_admin() out of the API-exposed public schema so it can't be called
-- as an RPC, while the RLS policies keep using it. (Addresses the
-- security-definer-executable advisors.) Applied to the live project 2026-07-09.

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
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

revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
  for select to authenticated using (private.is_admin());

drop policy if exists "admins read all registrations" on public.registrations;
create policy "admins read all registrations" on public.registrations
  for select to authenticated using (private.is_admin());

drop policy if exists "admins read all registration items" on public.registration_items;
create policy "admins read all registration items" on public.registration_items
  for select to authenticated using (private.is_admin());

drop function if exists public.is_admin();
