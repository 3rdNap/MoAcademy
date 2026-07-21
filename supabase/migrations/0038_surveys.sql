-- Surveys (D2L "Surveys" tool): course feedback. A teaching account authors a
-- survey (rating + free-text questions); enrolled students respond once; the
-- teacher reads aggregate results.
--
-- Anonymity done honestly: when a survey is anonymous, answers are written
-- with respondent_id NULL, so nothing links an answer back to a student — not
-- even for the teacher, not even at the database level. Completion is tracked
-- separately (survey_completions) so we can dedupe and show progress without
-- that link. All writing goes through the submit_survey RPC (SECURITY
-- DEFINER); there is no client INSERT policy on answers/completions.
--
-- Apply after 0037. Applied to the live project on 2026-07-13.

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  course_key text not null,
  title text not null,
  description text not null default '',
  anonymous boolean not null default true,
  closes_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_surveys_course on public.surveys (course_key);

alter table public.surveys enable row level security;

drop policy if exists "read course surveys" on public.surveys;
create policy "read course surveys" on public.surveys
  for select to authenticated
  using (
    private.teaches_course(course_key)
    or exists (
      select 1
      from private.subject_code_map m
      join public.subject_enrollments se
        on se.subject_code = m.code and se.user_id = (select auth.uid())
      where m.id = course_key
    )
  );

drop policy if exists "teaching manages surveys" on public.surveys;
create policy "teaching manages surveys" on public.surveys
  for all to authenticated
  using (private.teaches_course(course_key))
  with check (private.teaches_course(course_key));

create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  position int not null default 0,
  prompt text not null,
  kind text not null default 'rating' check (kind in ('rating', 'text')),
  created_at timestamptz not null default now()
);

create index if not exists idx_survey_questions_survey
  on public.survey_questions (survey_id);

alter table public.survey_questions enable row level security;

drop policy if exists "read survey questions" on public.survey_questions;
create policy "read survey questions" on public.survey_questions
  for select to authenticated
  using (
    exists (
      select 1 from public.surveys s
      where s.id = survey_id
        and (
          private.teaches_course(s.course_key)
          or exists (
            select 1
            from private.subject_code_map m
            join public.subject_enrollments se
              on se.subject_code = m.code and se.user_id = (select auth.uid())
            where m.id = s.course_key
          )
        )
    )
  );

drop policy if exists "teaching manages survey questions" on public.survey_questions;
create policy "teaching manages survey questions" on public.survey_questions
  for all to authenticated
  using (
    exists (
      select 1 from public.surveys s
      where s.id = survey_id and private.teaches_course(s.course_key)
    )
  )
  with check (
    exists (
      select 1 from public.surveys s
      where s.id = survey_id and private.teaches_course(s.course_key)
    )
  );

-- Answers. respondent_id is NULL for anonymous surveys (see the RPC). Rating
-- answers store the number as text in `value`; text answers store the text.
create table if not exists public.survey_answers (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  question_id uuid not null references public.survey_questions (id) on delete cascade,
  respondent_id uuid references public.profiles (id) on delete set null,
  value text not null default '',
  submitted_at timestamptz not null default now()
);

create index if not exists idx_survey_answers_survey on public.survey_answers (survey_id);
create index if not exists idx_survey_answers_question on public.survey_answers (question_id);

alter table public.survey_answers enable row level security;

-- The course's teachers read answers for aggregation; a student may read their
-- OWN answers only on a non-anonymous survey (anonymous answers have no
-- respondent_id, so this never matches them — the link genuinely doesn't
-- exist). No client INSERT policy: writes go through the RPC only.
drop policy if exists "read survey answers" on public.survey_answers;
create policy "read survey answers" on public.survey_answers
  for select to authenticated
  using (
    (respondent_id is not null and respondent_id = (select auth.uid()))
    or exists (
      select 1 from public.surveys s
      where s.id = survey_id and private.teaches_course(s.course_key)
    )
  );

-- Who has completed which survey — tracked even for anonymous surveys (dedupe
-- + progress), never joined to answers when anonymous.
create table if not exists public.survey_completions (
  survey_id uuid not null references public.surveys (id) on delete cascade,
  respondent_id uuid not null references public.profiles (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  primary key (survey_id, respondent_id)
);

alter table public.survey_completions enable row level security;

drop policy if exists "read survey completions" on public.survey_completions;
create policy "read survey completions" on public.survey_completions
  for select to authenticated
  using (
    respondent_id = (select auth.uid())
    or exists (
      select 1 from public.surveys s
      where s.id = survey_id and private.teaches_course(s.course_key)
    )
  );

-- Submit a survey response. Enforces one completion per student, writes the
-- answers (respondent_id NULL when the survey is anonymous), records the
-- completion. answer_map is { question_id: value }.
create or replace function public.submit_survey(sid uuid, answer_map jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  is_anon boolean;
  ck text;
  enrolled boolean;
  q record;
  v text;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  select anonymous, course_key into is_anon, ck from public.surveys where id = sid;
  if ck is null then
    raise exception 'no such survey';
  end if;
  -- Must be enrolled in (or teach) the course.
  select exists (
    select 1
    from private.subject_code_map m
    join public.subject_enrollments se
      on se.subject_code = m.code and se.user_id = uid
    where m.id = ck
  ) or private.teaches_course(ck) into enrolled;
  if not enrolled then
    raise exception 'not enrolled in this course';
  end if;
  if exists (
    select 1 from public.survey_completions
    where survey_id = sid and respondent_id = uid
  ) then
    raise exception 'already responded';
  end if;

  for q in select id from public.survey_questions where survey_id = sid loop
    v := answer_map ->> q.id::text;
    if v is not null and v <> '' then
      insert into public.survey_answers (survey_id, question_id, respondent_id, value)
      values (sid, q.id, case when is_anon then null else uid end, v);
    end if;
  end loop;

  insert into public.survey_completions (survey_id, respondent_id)
  values (sid, uid);
  return true;
end;
$$;

revoke execute on function public.submit_survey(uuid, jsonb) from public, anon;
grant execute on function public.submit_survey(uuid, jsonb) to authenticated;
