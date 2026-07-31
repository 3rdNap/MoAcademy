-- MoAcademy class rosters
--
-- Admins enrol people into subjects (0018), but until now nobody could see who
-- else was in a class: `subject_enrollments` is readable only for your own
-- rows, and `profiles` only for your own row (plus admins, 0015/0016). The
-- course People tab and the "who teaches this?" line therefore fell back to the
-- bundled demo roster.
--
-- Widening the table policies would expose every profile column to classmates.
-- Instead this adds one guarded reader, `public.subject_rosters(codes, term)`:
-- SECURITY DEFINER so it can join enrolments to profiles, but it returns rows
-- only for subjects the caller is actually enrolled in (any role) — or every
-- requested subject when the caller is an admin. Contact details come back only
-- for a subject the caller teaches (or administers); classmates see a name, an
-- avatar colour and nothing else.
--
-- Apply after 0018. The app degrades gracefully until then: a missing function
-- is caught and the People tab falls back to the demo roster.

create or replace function public.subject_rosters(
  p_codes text[],
  p_term text default 'Fall 2026'
)
returns table (
  subject_code text,
  user_id uuid,
  full_name text,
  email text,
  avatar_color text,
  enrol_role text
)
language sql
security definer
stable
set search_path = public
as $$
  with caller as (
    select private.is_admin() as is_admin
  ),
  -- One row per requested subject the caller may read, flagging whether they
  -- may also see contact details for it (they teach it, or they're an admin).
  scope as (
    select
      c.code as subject_code,
      coalesce(bool_or(e.role = 'instructor'), false)
        or (select is_admin from caller) as may_see_contact
    from unnest(p_codes) as c (code)
    left join public.subject_enrollments e
      on e.subject_code = c.code
     and e.term = p_term
     and e.user_id = auth.uid()
    group by c.code
    having count(e.id) > 0 or (select is_admin from caller)
  )
  select
    s.subject_code,
    p.id,
    coalesce(p.full_name, ''),
    case when s.may_see_contact then p.email else null end,
    coalesce(p.avatar_color, '#0284c7'),
    e.role
  from scope s
  join public.subject_enrollments e
    on e.subject_code = s.subject_code
   and e.term = p_term
  join public.profiles p
    on p.id = e.user_id
  order by
    s.subject_code,
    case when e.role = 'instructor' then 0 else 1 end,
    coalesce(p.full_name, '');
$$;

-- Callable over the API by signed-in users only; the guard above decides what
-- they actually get back. Anonymous visitors keep the demo roster.
revoke execute on function public.subject_rosters(text[], text) from public, anon;
grant execute on function public.subject_rosters(text[], text) to authenticated;
