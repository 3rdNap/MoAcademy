-- Assignment rubrics: instructors define criteria with point values per
-- assignment, grade each criterion per student, and students see the
-- breakdown. Criteria are readable like assignments (public read); scores
-- follow submission visibility (own row, teaching account, linked guardian).
-- Writes are scoped to the assignment's teaching accounts via
-- private.teaches_assignment — not generic instructor role.
--
-- Apply after 0030. Applied to the live project on 2026-07-12.

create table if not exists public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  description text not null,
  points int not null default 0 check (points >= 0),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_rubric_criteria_assignment
  on public.rubric_criteria (assignment_id);

alter table public.rubric_criteria enable row level security;

drop policy if exists "read rubric criteria" on public.rubric_criteria;
create policy "read rubric criteria" on public.rubric_criteria
  for select using (true);

drop policy if exists "teaching writes rubric criteria" on public.rubric_criteria;
create policy "teaching writes rubric criteria" on public.rubric_criteria
  for all to authenticated
  using (private.teaches_assignment(assignment_id))
  with check (private.teaches_assignment(assignment_id));

-- One awarded score per criterion per student.
create table if not exists public.rubric_scores (
  id uuid primary key default gen_random_uuid(),
  criterion_id uuid not null references public.rubric_criteria (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  points int not null default 0 check (points >= 0),
  created_at timestamptz not null default now(),
  unique (criterion_id, student_id)
);

create index if not exists idx_rubric_scores_student on public.rubric_scores (student_id);

alter table public.rubric_scores enable row level security;

drop policy if exists "read own or taught rubric scores" on public.rubric_scores;
create policy "read own or taught rubric scores" on public.rubric_scores
  for select to authenticated
  using (
    (select auth.uid()) = student_id
    or private.is_guardian_of(student_id)
    or exists (
      select 1 from public.rubric_criteria c
      where c.id = criterion_id and private.teaches_assignment(c.assignment_id)
    )
  );

drop policy if exists "teaching writes rubric scores" on public.rubric_scores;
create policy "teaching writes rubric scores" on public.rubric_scores
  for all to authenticated
  using (
    exists (
      select 1 from public.rubric_criteria c
      where c.id = criterion_id and private.teaches_assignment(c.assignment_id)
    )
  )
  with check (
    exists (
      select 1 from public.rubric_criteria c
      where c.id = criterion_id and private.teaches_assignment(c.assignment_id)
    )
  );
