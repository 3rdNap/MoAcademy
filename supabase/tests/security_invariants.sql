-- MoAcademy security-invariant regression checks.
--
-- Each block runs as a non-privileged `authenticated` user (RLS enforced) and
-- ROLLS BACK, so running this file mutates nothing. It proves the
-- security-critical surface holds: grade tamper-proofing, answer-key
-- isolation, submission privacy, and survey anonymity. Re-run after any
-- migration that touches submissions, quizzes, surveys or their RLS.
--
-- Usage (Supabase SQL editor or psql): replace the two ids below with any two
-- real profiles — STUDENT_ID must be a non-admin who does NOT teach 'sub_math'
-- (subject code MATH), OTHER_ID any other profile. Verified 2026-07-13.
--
--   STUDENT_ID = 9507a0a2-f8e6-4adf-9b67-fcf2f236d663
--   OTHER_ID   = 30247880-d4c0-4203-85d7-b3a07f9d8aa9
--
-- Expected results are noted beside each final SELECT.

-- 1. A student inserting their own submission cannot pre-set a grade: the
--    0032 insert guard nulls score and downgrades 'graded' → 'submitted'.
--    EXPECT: stored_status = submitted, stored_score = null
begin;
  insert into public.assignments (id, course_key, title, type, description, due_at, points)
  values ('11111111-1111-1111-1111-111111111111', 'sub_math', 'Sec Test', 'assignment', '', now() + interval '2 days', 100);
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"9507a0a2-f8e6-4adf-9b67-fcf2f236d663","role":"authenticated"}';
  insert into public.submissions (assignment_id, user_id, status, body, score)
  values ('11111111-1111-1111-1111-111111111111', '9507a0a2-f8e6-4adf-9b67-fcf2f236d663', 'graded', 'my work', 100)
  returning status as stored_status, score as stored_score;
rollback;

-- 2. A student cannot UPDATE their own submission to grade themselves: the
--    field guard rejects it. EXPECT: score_after = null, status_after = submitted
begin;
  insert into public.assignments (id, course_key, title, type, description, due_at, points)
  values ('22222222-2222-2222-2222-222222222222', 'sub_math', 'T2', 'assignment', '', now() + interval '2 days', 100);
  insert into public.submissions (id, assignment_id, user_id, status, body)
  values ('22222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '9507a0a2-f8e6-4adf-9b67-fcf2f236d663', 'submitted', 'w');
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"9507a0a2-f8e6-4adf-9b67-fcf2f236d663","role":"authenticated"}';
  do $$ begin
    update public.submissions set score = 99, status = 'graded'
    where id = '22222222-0000-0000-0000-000000000002';
  exception when others then null; end $$;
  select coalesce(score::text, 'null') as score_after, status as status_after
  from public.submissions where id = '22222222-0000-0000-0000-000000000002';
rollback;

-- 3 & 4. A student sees NEITHER quiz answer keys NOR another user's
--    submission. EXPECT: keys_visible = 0, other_subs_visible = 0
begin;
  insert into public.assignments (id, course_key, title, type, description, due_at, points)
  values ('33333333-3333-3333-3333-333333333333', 'sub_math', 'Quiz', 'quiz', '', now() + interval '2 days', 10);
  insert into public.quiz_questions (id, assignment_id, position, prompt, options, points, kind)
  values ('33333333-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 0, 'Q', array['a','b'], 10, 'mcq');
  insert into public.quiz_answer_keys (question_id, correct_index) values ('33333333-0000-0000-0000-000000000001', 1);
  insert into public.submissions (id, assignment_id, user_id, status, body, score)
  values ('33333333-0000-0000-0000-000000000009', '33333333-3333-3333-3333-333333333333', '30247880-d4c0-4203-85d7-b3a07f9d8aa9', 'graded', 'other work', 8);
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"9507a0a2-f8e6-4adf-9b67-fcf2f236d663","role":"authenticated"}';
  select
    (select count(*) from public.quiz_answer_keys where question_id = '33333333-0000-0000-0000-000000000001') as keys_visible,
    (select count(*) from public.submissions where id = '33333333-0000-0000-0000-000000000009') as other_subs_visible;
rollback;

-- 5. An anonymous survey stores answers with NO respondent link (submit_survey
--    RPC). EXPECT: anonymous_ok = true, value preserved
begin;
  insert into public.surveys (id, course_key, title, anonymous)
  values ('44444444-4444-4444-4444-444444444444', 'sub_math', 'Feedback', true);
  insert into public.survey_questions (id, survey_id, position, prompt, kind)
  values ('44444444-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 0, 'How was it?', 'text');
  insert into public.subject_enrollments (user_id, subject_code, role, term)
  values ('9507a0a2-f8e6-4adf-9b67-fcf2f236d663', 'MATH', 'student', (select value from public.app_settings where key='current_term'));
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"9507a0a2-f8e6-4adf-9b67-fcf2f236d663","role":"authenticated"}';
  select public.submit_survey('44444444-4444-4444-4444-444444444444', '{"44444444-0000-0000-0000-000000000001":"It was great"}'::jsonb);
  reset role;
  select value, (respondent_id is null) as anonymous_ok
  from public.survey_answers where survey_id = '44444444-4444-4444-4444-444444444444';
rollback;
