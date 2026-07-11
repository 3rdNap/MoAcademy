-- Real inbox messaging + course-mate visibility.
--
-- Canvas-style rules: people who share a subject in the same term (student or
-- instructor side) can see each other on the People page and message each
-- other; admins can reach anyone. Names are denormalized onto each message
-- (like announcements.author) so reading a thread never requires cross-profile
-- reads beyond what RLS already allows.
--
-- Apply after 0020. Applied to the live project on 2026-07-11.

-- 1. Do two users share a subject enrolment (any role) this or any term?
create or replace function private.shares_subject_with(other uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.subject_enrollments a
    join public.subject_enrollments b
      on a.subject_code = b.subject_code and a.term = b.term
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

revoke execute on function private.shares_subject_with(uuid) from public, anon;
grant execute on function private.shares_subject_with(uuid) to authenticated;

-- 2. Course-mates are visible to each other: a student sees real classmates
--    and their instructors (the People page roster), not just the reverse.
drop policy if exists "read course-mate enrollments" on public.subject_enrollments;
create policy "read course-mate enrollments" on public.subject_enrollments
  for select to authenticated
  using (private.shares_subject_with(user_id));

drop policy if exists "read course-mate profiles" on public.profiles;
create policy "read course-mate profiles" on public.profiles
  for select to authenticated
  using (private.shares_subject_with(id));

-- 3. Who may message whom: admins anyone; anyone their course-mates; anyone
--    may write to an admin (the office).
create or replace function private.can_message(recipient uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select private.is_admin()
    or private.shares_subject_with(recipient)
    or exists (
      select 1 from public.profiles p where p.id = recipient and p.role = 'admin'
    );
$$;

revoke execute on function private.can_message(uuid) from public, anon;
grant execute on function private.can_message(uuid) to authenticated;

-- 4. Messages. Flat rows; the app groups a thread by the other participant.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  sender_name text not null,
  recipient_name text not null,
  subject text not null default '',
  body text not null,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_messages_sender on public.messages (sender_id);
create index if not exists idx_messages_recipient on public.messages (recipient_id);

alter table public.messages enable row level security;

drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages" on public.messages
  for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "send as self to allowed recipient" on public.messages;
create policy "send as self to allowed recipient" on public.messages
  for insert to authenticated
  with check (auth.uid() = sender_id and private.can_message(recipient_id));

-- The recipient may mark a message read — and change nothing else (column
-- grant limits client updates to read_at).
drop policy if exists "recipient marks read" on public.messages;
create policy "recipient marks read" on public.messages
  for update to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

revoke update on public.messages from authenticated, anon;
grant update (read_at) on public.messages to authenticated;

revoke insert on public.messages from authenticated, anon;
grant insert (sender_id, recipient_id, sender_name, recipient_name, subject, body)
  on public.messages to authenticated;
