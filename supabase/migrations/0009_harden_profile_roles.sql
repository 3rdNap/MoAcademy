-- Close two privilege-escalation paths to the admin role (applied to the
-- live project on 2026-07-04):
--
-- 1. handle_new_user copied role verbatim from signup metadata, so a crafted
--    signup could self-assign 'admin'. Only student/instructor pass through
--    now; anything else falls back to 'student'.
-- 2. The "update own profile" / "insert own profile" policies allowed writing
--    any column, including role. Column-level grants now limit client writes
--    to the harmless columns; role changes require the service role (or SQL).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    case
      when new.raw_user_meta_data ->> 'role' in ('student', 'instructor')
        then new.raw_user_meta_data ->> 'role'
      else 'student'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_color) on public.profiles to authenticated;

revoke insert on public.profiles from authenticated, anon;
grant insert (id, full_name, email, avatar_color) on public.profiles to authenticated;
