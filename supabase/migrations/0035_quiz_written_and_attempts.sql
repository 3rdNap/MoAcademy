-- Quiz depth: written-response questions + multiple attempts.
--
-- * quiz_questions gains kind ('mcq' | 'written'); written questions have no
--   options and no answer key — their answers are free text a teacher grades.
-- * assignments gains quiz_attempts_allowed (1-10); quiz_attempts drops the
--   one-attempt uniqueness for (assignment, student, attempt_no).
-- * submit_quiz_attempt now: enforces the attempt limit; auto-grades the MCQ
--   portion; when the quiz is fully auto-gradable the submission lands
--   'graded' with the BEST attempt's scaled score; when written questions
--   exist the submission lands 'submitted' (score cleared) for the teacher to
--   finish grading with the answers in front of them.
--
-- Apply after 0034. Applied to the live project on 2026-07-13.

alter table public.quiz_questions
  add column if not exists kind text not null default 'mcq'
    check (kind in ('mcq', 'written'));

alter table public.quiz_questions
  drop constraint if exists quiz_questions_options_check;
alter table public.quiz_questions
  alter column options set default '{}';
alter table public.quiz_questions
  add constraint quiz_questions_options_check check (
    (kind = 'mcq' and array_length(options, 1) between 2 and 6)
    or (kind = 'written' and coalesce(array_length(options, 1), 0) = 0)
  );

alter table public.assignments
  add column if not exists quiz_attempts_allowed int not null default 1
    check (quiz_attempts_allowed between 1 and 10);

alter table public.quiz_attempts
  add column if not exists attempt_no int not null default 1;
alter table public.quiz_attempts
  drop constraint if exists quiz_attempts_assignment_id_student_id_key;
create unique index if not exists uq_quiz_attempts_per_no
  on public.quiz_attempts (assignment_id, student_id, attempt_no);

create or replace function public.submit_quiz_attempt(aid uuid, answer_map jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  assignment_points int;
  allowed int;
  prior int;
  earned int := 0;
  auto_total int := 0;
  written_total int := 0;
  best_earned int;
  scaled int;
  q record;
  chosen int;
  correct_ids uuid[] := '{}';
  has_written boolean := false;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  select points, quiz_attempts_allowed
    into assignment_points, allowed
    from public.assignments where id = aid;
  if assignment_points is null then
    raise exception 'no such assignment';
  end if;
  select count(*) into prior
    from public.quiz_attempts
    where assignment_id = aid and student_id = uid;
  if prior >= allowed then
    raise exception 'no attempts left';
  end if;

  for q in
    select qq.id, qq.points, qq.kind, k.correct_index
    from public.quiz_questions qq
    left join public.quiz_answer_keys k on k.question_id = qq.id
    where qq.assignment_id = aid
  loop
    if q.kind = 'written' then
      has_written := true;
      written_total := written_total + q.points;
      continue;
    end if;
    if q.correct_index is null then
      continue; -- keyless MCQ can't be graded; excluded from the total
    end if;
    auto_total := auto_total + q.points;
    chosen := nullif(answer_map ->> q.id::text, '')::int;
    if chosen is not null and chosen = q.correct_index then
      earned := earned + q.points;
      correct_ids := array_append(correct_ids, q.id);
    end if;
  end loop;

  if auto_total = 0 and not has_written then
    raise exception 'quiz has no questions';
  end if;

  insert into public.quiz_attempts
    (assignment_id, student_id, score, total, answers, attempt_no)
  values (aid, uid, earned, auto_total, answer_map, prior + 1);

  perform set_config('app.quiz_autograde', 'on', true);

  if has_written then
    -- Teacher finishes grading; MCQ portion is visible in the attempt view.
    insert into public.submissions
      (assignment_id, user_id, status, body, score, submitted_at)
    values
      (aid, uid, 'submitted', 'Quiz attempt (written answers await grading)', null, now())
    on conflict (assignment_id, user_id) do update
      set status = 'submitted',
          body = excluded.body,
          score = null,
          graded_at = null,
          submitted_at = excluded.submitted_at;
    scaled := null;
  else
    select max(score) into best_earned
      from public.quiz_attempts
      where assignment_id = aid and student_id = uid;
    scaled := round(best_earned::numeric / auto_total * assignment_points);
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
  end if;

  return jsonb_build_object(
    'earned', earned,
    'total', auto_total,
    'writtenTotal', written_total,
    'pendingWritten', has_written,
    'score', scaled,
    'points', assignment_points,
    'correct', to_jsonb(correct_ids),
    'attemptNo', prior + 1,
    'attemptsAllowed', allowed
  );
end;
$$;

revoke execute on function public.submit_quiz_attempt(uuid, jsonb) from public, anon;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;
