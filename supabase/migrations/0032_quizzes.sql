-- Structured quizzes: instructors author multiple-choice questions on a
-- quiz-type assignment; students take one attempt which is auto-graded
-- server-side and lands in the gradebook as a graded submission.
--
-- Key design points:
-- * Answer keys live in a separate teacher-only table — RLS is row-level, so
--   a same-table column could never be hidden from students.
-- * Grading runs inside a SECURITY DEFINER RPC: the key never leaves the
--   database, and the score is scaled to the assignment's points.
-- * The submissions field guard gains (a) an insert guard — pre-existing gap:
--   it only fired on UPDATE, so a student could insert their own row with a
--   score — and (b) a transaction-local autograde escape used by the RPC.
--
-- Apply after 0031. Applied to the live project on 2026-07-12.

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  position int not null default 0,
  prompt text not null,
  options text[] not null check (array_length(options, 1) between 2 and 6),
  points int not null default 1 check (points > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_quiz_questions_assignment
  on public.quiz_questions (assignment_id);

alter table public.quiz_questions enable row level security;

drop policy if exists "read quiz questions" on public.quiz_questions;
create policy "read quiz questions" on public.quiz_questions
  for select to authenticated using (true);

drop policy if exists "teaching writes quiz questions" on public.quiz_questions;
create policy "teaching writes quiz questions" on public.quiz_questions
  for all to authenticated
  using (private.teaches_assignment(assignment_id))
  with check (private.teaches_assignment(assignment_id));

-- The answer key, readable/writable ONLY by the assignment's teachers.
create table if not exists public.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions (id) on delete cascade,
  correct_index int not null check (correct_index >= 0)
);

alter table public.quiz_answer_keys enable row level security;

drop policy if exists "teaching manages answer keys" on public.quiz_answer_keys;
create policy "teaching manages answer keys" on public.quiz_answer_keys
  for all to authenticated
  using (
    exists (
      select 1 from public.quiz_questions q
      where q.id = question_id and private.teaches_assignment(q.assignment_id)
    )
  )
  with check (
    exists (
      select 1 from public.quiz_questions q
      where q.id = question_id and private.teaches_assignment(q.assignment_id)
    )
  );

-- One attempt per student per quiz. Written only by the RPC (no insert
-- policy → direct client inserts are denied; SECURITY DEFINER bypasses RLS).
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  score int not null,
  total int not null,
  answers jsonb not null default '{}'::jsonb,
  unique (assignment_id, student_id)
);

create index if not exists idx_quiz_attempts_student on public.quiz_attempts (student_id);
create index if not exists idx_quiz_attempts_assignment on public.quiz_attempts (assignment_id);

alter table public.quiz_attempts enable row level security;

drop policy if exists "read own or taught attempts" on public.quiz_attempts;
create policy "read own or taught attempts" on public.quiz_attempts
  for select to authenticated
  using (
    (select auth.uid()) = student_id
    or private.is_guardian_of(student_id)
    or private.teaches_assignment(assignment_id)
  );

-- ----------------------- submissions guard hardening -----------------------

-- Update guard: unchanged semantics, plus the RPC's transaction-local escape.
create or replace function private.guard_submission_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.quiz_autograde', true) = 'on' then
    return new;
  end if;
  if private.teaches_assignment(new.assignment_id) then
    new.body := old.body;
    new.file_name := old.file_name;
    new.file_path := old.file_path;
    new.submitted_at := old.submitted_at;
  else
    if new.score is distinct from old.score
      or new.feedback is distinct from old.feedback
      or new.graded_at is distinct from old.graded_at
      or new.graded_by is distinct from old.graded_by
    then
      raise exception 'only the teaching account can grade a submission';
    end if;
  end if;
  return new;
end;
$$;

-- Insert guard (new): a non-teaching insert may not arrive pre-graded.
create or replace function private.guard_submission_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.quiz_autograde', true) = 'on' then
    return new;
  end if;
  if not private.teaches_assignment(new.assignment_id) then
    new.score := null;
    new.feedback := null;
    new.graded_at := null;
    new.graded_by := null;
    if new.status in ('graded') then
      new.status := 'submitted';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_guard_insert on public.submissions;
create trigger submissions_guard_insert
  before insert on public.submissions
  for each row execute function private.guard_submission_insert();

-- ------------------------------ grading RPC -------------------------------

-- Takes {question_id: chosen_option_index}. Grades against the key, records
-- the attempt, and upserts a graded submission scaled to assignment.points.
create or replace function public.submit_quiz_attempt(aid uuid, answer_map jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  assignment_points int;
  earned int := 0;
  total int := 0;
  scaled int;
  q record;
  chosen int;
  correct_ids uuid[] := '{}';
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  select points into assignment_points from public.assignments where id = aid;
  if assignment_points is null then
    raise exception 'no such assignment';
  end if;
  if exists (
    select 1 from public.quiz_attempts
    where assignment_id = aid and student_id = uid
  ) then
    raise exception 'already attempted';
  end if;

  for q in
    select qq.id, qq.points, k.correct_index
    from public.quiz_questions qq
    join public.quiz_answer_keys k on k.question_id = qq.id
    where qq.assignment_id = aid
  loop
    total := total + q.points;
    chosen := nullif(answer_map ->> q.id::text, '')::int;
    if chosen is not null and chosen = q.correct_index then
      earned := earned + q.points;
      correct_ids := array_append(correct_ids, q.id);
    end if;
  end loop;

  if total = 0 then
    raise exception 'quiz has no questions';
  end if;

  scaled := round(earned::numeric / total * assignment_points);

  insert into public.quiz_attempts (assignment_id, student_id, score, total, answers)
  values (aid, uid, earned, total, answer_map);

  perform set_config('app.quiz_autograde', 'on', true);
  insert into public.submissions
    (assignment_id, user_id, status, body, score, submitted_at, graded_at)
  values
    (aid, uid, 'graded', 'Quiz attempt (auto-graded)', scaled, now(), now())
  on conflict (assignment_id, user_id) do update
    set status = 'graded',
        body = excluded.body,
        score = excluded.score,
        submitted_at = excluded.submitted_at,
        graded_at = excluded.graded_at;

  return jsonb_build_object(
    'earned', earned,
    'total', total,
    'score', scaled,
    'points', assignment_points,
    'correct', to_jsonb(correct_ids)
  );
end;
$$;

revoke execute on function public.submit_quiz_attempt(uuid, jsonb) from public, anon;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;
