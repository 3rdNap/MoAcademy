-- Scope the textbook and study-guide libraries to each person's own
-- allocations. Previously both tables were readable by every signed-in user
-- (`using (true)`) and only the frontend hid the rows — so the raw records
-- were reachable through the API by anyone. This enforces the real boundary
-- in RLS: you can read a subject's books/guides only if you are registered
-- for that subject (as a student) or teach it (instructor enrolment), or you
-- are an admin. Admins still publish/manage; instructors still manage their
-- own subjects' textbooks (unchanged manage policies).
--
-- Textbooks key on subject *code* (e.g. 'MATH'); study guides key on the
-- free-text subject *name* (e.g. 'Mathematics'). We bridge the name via the
-- private subject_code_map (extended here with a name column) so the check
-- stays inside a SECURITY DEFINER helper and the map is never API-exposed.
--
-- Apply after 0042.

-- 1. Extend the private id↔code map with the subject name (from
--    src/lib/billing/subjects.ts) so study guides (keyed by name) can resolve.
alter table private.subject_code_map
  add column if not exists name text;

update private.subject_code_map set name = v.name
from (values
  ('sub_math', 'Mathematics'),
  ('sub_physci', 'Physical Sciences'),
  ('sub_lifesci', 'Life Sciences'),
  ('sub_it', 'Information Technology'),
  ('sub_mathlit', 'Mathematical Literacy'),
  ('sub_english', 'English'),
  ('sub_afrikaans', 'Afrikaans'),
  ('sub_accounting', 'Accounting'),
  ('sub_economics', 'Economics'),
  ('sub_business', 'Business Studies'),
  ('sub_geography', 'Geography'),
  ('sub_history', 'History')
) as v(id, name)
where private.subject_code_map.id = v.id;

-- 2. Membership helpers. SECURITY DEFINER so the policy (evaluated as the
--    invoking role) can consult subject_enrollments / the private map without
--    the caller needing privileges on them. Any enrolment for the subject
--    counts — student OR instructor, any term — because a person's textbook
--    and study-guide allocation follows the subjects they are attached to.
create or replace function private.registered_for_subject_code(ck text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.subject_enrollments se
    where se.subject_code = ck
      and se.user_id = auth.uid()
  );
$$;

revoke execute on function private.registered_for_subject_code(text) from public, anon;
grant execute on function private.registered_for_subject_code(text) to authenticated;

create or replace function private.registered_for_subject_name(sname text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from private.subject_code_map m
    join public.subject_enrollments se
      on se.subject_code = m.code and se.user_id = auth.uid()
    where m.name = sname
  );
$$;

revoke execute on function private.registered_for_subject_name(text) from public, anon;
grant execute on function private.registered_for_subject_name(text) to authenticated;

-- 3. Textbooks: read only your own subjects' books (admins read all).
drop policy if exists "read textbooks" on public.textbooks;
create policy "read textbooks" on public.textbooks
  for select to authenticated
  using (
    private.is_admin()
    or private.registered_for_subject_code(subject_code)
  );

-- 4. Study guides: read only your own subjects' guides (admins read all).
--    Now restricted to authenticated (was open to anon); the anonymous demo
--    falls back to the bundled seed library client-side.
drop policy if exists "read study guides" on public.study_guides;
create policy "read study guides" on public.study_guides
  for select to authenticated
  using (
    private.is_admin()
    or private.registered_for_subject_name(subject)
  );
