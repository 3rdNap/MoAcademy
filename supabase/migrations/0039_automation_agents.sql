-- Intelligent Agents (D2L "Intelligent Agents"): scheduled automation that
-- runs when nobody is browsing. Uses pg_cron to fire SECURITY DEFINER
-- functions on a schedule. Actions are IN-APP messages (institution logins
-- aren't real mailboxes), sent from the course's instructor.
--
-- Two agents ship enabled:
--   * deadline_reminder — students with an assignment due in the next 48h and
--     no submission get a nudge.
--   * missing_work — students with an assignment now >24h overdue and no
--     submission get a follow-up.
-- Both dedupe via automation_log so a student is nudged at most once per
-- (agent, assignment).
--
-- Apply after 0038. Applied to the live project on 2026-07-13.

create extension if not exists pg_cron;

-- Admin-toggleable agent registry.
create table if not exists public.automation_agents (
  key text primary key,
  name text not null,
  description text not null default '',
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.automation_agents (key, name, description) values
  ('deadline_reminder', 'Deadline reminder',
   'Messages students an assignment reminder ~2 days before it is due when they have not submitted.'),
  ('missing_work', 'Missing-work follow-up',
   'Messages students when an assignment is overdue and still unsubmitted.')
on conflict (key) do nothing;

alter table public.automation_agents enable row level security;

drop policy if exists "read automation agents" on public.automation_agents;
create policy "read automation agents" on public.automation_agents
  for select to authenticated using (private.is_admin());

drop policy if exists "admin manages automation agents" on public.automation_agents;
create policy "admin manages automation agents" on public.automation_agents
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- One row per action taken, both for dedupe and for the admin run log.
create table if not exists public.automation_log (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null,
  assignment_id uuid references public.assignments (id) on delete cascade,
  student_id uuid references public.profiles (id) on delete cascade,
  detail text not null default '',
  created_at timestamptz not null default now(),
  unique (agent_key, assignment_id, student_id)
);

create index if not exists idx_automation_log_created on public.automation_log (created_at desc);

alter table public.automation_log enable row level security;

drop policy if exists "admin reads automation log" on public.automation_log;
create policy "admin reads automation log" on public.automation_log
  for select to authenticated using (private.is_admin());

-- Resolve a subject's teaching account (sender for the nudge). course_key on
-- assignments is the subject id; map to code, find an instructor enrolment.
create or replace function private.course_instructor(ck text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select se.user_id
  from private.subject_code_map m
  join public.subject_enrollments se
    on se.subject_code = m.code and se.role = 'instructor'
  where m.id = ck
  order by se.created_at
  limit 1;
$$;

-- Shared nudge engine: for assignments whose due date falls in [lo, hi] from
-- now, message enrolled students with no submission, once per (agent,
-- assignment) per student. `subject_line`/`body_prefix` shape the message.
create or replace function private.run_assignment_nudge(
  agent text,
  lo interval,
  hi interval,
  subject_line text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  a record;
  instructor uuid;
  instructor_name text;
  stu record;
begin
  if not exists (select 1 from public.automation_agents where key = agent and enabled) then
    return 0;
  end if;

  for a in
    select id, course_key, title, due_at
    from public.assignments
    where due_at >= now() + lo and due_at < now() + hi
  loop
    instructor := private.course_instructor(a.course_key);
    if instructor is null then
      continue; -- no teacher to send from
    end if;
    select full_name into instructor_name from public.profiles where id = instructor;

    for stu in
      select se.user_id, p.full_name
      from private.subject_code_map m
      join public.subject_enrollments se
        on se.subject_code = m.code and se.role = 'student'
      join public.profiles p on p.id = se.user_id
      where m.id = a.course_key
        and not exists (
          select 1 from public.submissions s
          where s.assignment_id = a.id and s.user_id = se.user_id
            and s.status in ('submitted', 'graded', 'late')
        )
        and not exists (
          select 1 from public.automation_log l
          where l.agent_key = agent and l.assignment_id = a.id and l.student_id = se.user_id
        )
    loop
      insert into public.messages
        (sender_id, recipient_id, sender_name, recipient_name, subject, body)
      values (
        instructor, stu.user_id,
        coalesce(instructor_name, 'MoAcademy'), stu.full_name,
        subject_line,
        format('Hi %s — this is a reminder about "%s", due %s. It looks like you haven''t turned it in yet. Reach out if you need help.',
               split_part(coalesce(stu.full_name, 'there'), ' ', 1),
               a.title,
               to_char(a.due_at, 'Dy DD Mon HH24:MI'))
      );
      insert into public.automation_log (agent_key, assignment_id, student_id, detail)
      values (agent, a.id, stu.user_id, a.title);
      n := n + 1;
    end loop;
  end loop;
  return n;
end;
$$;

create or replace function private.run_deadline_reminders()
returns int language sql security definer set search_path = public as $$
  select private.run_assignment_nudge('deadline_reminder', interval '0', interval '48 hours', 'Reminder: upcoming deadline');
$$;

create or replace function private.run_missing_work()
returns int language sql security definer set search_path = public as $$
  select private.run_assignment_nudge('missing_work', interval '-72 hours', interval '-24 hours', 'Missing work — still time to submit');
$$;

-- Schedule both nightly (07:00 UTC). Unschedule first so re-applying is safe.
select cron.unschedule('moacademy_deadline_reminders')
  where exists (select 1 from cron.job where jobname = 'moacademy_deadline_reminders');
select cron.unschedule('moacademy_missing_work')
  where exists (select 1 from cron.job where jobname = 'moacademy_missing_work');

select cron.schedule('moacademy_deadline_reminders', '0 7 * * *', $$ select private.run_deadline_reminders(); $$);
select cron.schedule('moacademy_missing_work', '30 7 * * *', $$ select private.run_missing_work(); $$);
