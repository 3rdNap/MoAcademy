-- Office-hours booking: instructors publish time slots on their course;
-- course-mates book them. Slot management is plain RLS (the instructor owns
-- their rows); BOOKING goes through SECURITY DEFINER RPCs so a student can
-- flip exactly booked_by/booked_at on an open slot — a generic update policy
-- would let them edit the slot itself, and column grants can't distinguish
-- instructor from student within the authenticated role.
--
-- Apply after 0032. Applied to the live project on 2026-07-12.

create table if not exists public.office_hour_slots (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles (id) on delete cascade,
  course_key text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default '',
  booked_by uuid references public.profiles (id) on delete set null,
  booked_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_office_hour_slots_instructor
  on public.office_hour_slots (instructor_id);
create index if not exists idx_office_hour_slots_course
  on public.office_hour_slots (course_key, starts_at);
create index if not exists idx_office_hour_slots_booked_by
  on public.office_hour_slots (booked_by);

alter table public.office_hour_slots enable row level security;

-- Visible to the instructor, anyone sharing a subject with them, the booker,
-- and admins.
drop policy if exists "read office hour slots" on public.office_hour_slots;
create policy "read office hour slots" on public.office_hour_slots
  for select to authenticated
  using (
    (select auth.uid()) = instructor_id
    or (select auth.uid()) = booked_by
    or private.shares_subject_with(instructor_id)
    or private.is_admin()
  );

-- The instructor manages their own slots (booking is RPC-only).
drop policy if exists "instructor manages own slots" on public.office_hour_slots;
create policy "instructor manages own slots" on public.office_hour_slots
  for all to authenticated
  using ((select auth.uid()) = instructor_id)
  with check ((select auth.uid()) = instructor_id);

-- Book an open future slot as the signed-in course-mate.
create or replace function public.book_office_hour(slot uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s record;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  select * into s from public.office_hour_slots where id = slot for update;
  if s is null then
    raise exception 'no such slot';
  end if;
  if s.booked_by is not null then
    raise exception 'slot already booked';
  end if;
  if s.starts_at <= now() then
    raise exception 'slot is in the past';
  end if;
  if s.instructor_id = uid then
    raise exception 'cannot book your own slot';
  end if;
  if not private.shares_subject_with(s.instructor_id) and not private.is_admin() then
    raise exception 'not a course-mate of this instructor';
  end if;
  update public.office_hour_slots
    set booked_by = uid, booked_at = now()
    where id = slot;
  return true;
end;
$$;

-- The booker frees their own booking; the instructor can free any of theirs.
create or replace function public.cancel_office_hour(slot uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s record;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  select * into s from public.office_hour_slots where id = slot for update;
  if s is null then
    raise exception 'no such slot';
  end if;
  if s.booked_by is distinct from uid and s.instructor_id is distinct from uid then
    raise exception 'not your booking';
  end if;
  update public.office_hour_slots
    set booked_by = null, booked_at = null
    where id = slot;
  return true;
end;
$$;

revoke execute on function public.book_office_hour(uuid) from public, anon;
grant execute on function public.book_office_hour(uuid) to authenticated;
revoke execute on function public.cancel_office_hour(uuid) from public, anon;
grant execute on function public.cancel_office_hour(uuid) to authenticated;
