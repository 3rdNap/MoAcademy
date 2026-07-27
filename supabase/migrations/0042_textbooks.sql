-- Textbooks: a per-subject reading list. Each row is a book assigned to a
-- subject (required or recommended), with bibliographic detail and a link to
-- buy/read online plus an optional uploaded cover and PDF. Managed by admins
-- and the subject's instructors; read by any signed-in user (the frontend
-- scopes the student view to their enrolled subjects, like study guides).
--
-- Keyed by subject_code (e.g. 'MATH'), matching study-guide/enrolment scoping.
-- The instructor-manage check reads subject_enrollments directly (the caller's
-- own instructor row is visible under that table's own-row RLS), so no private
-- helper is needed.
--
-- Apply after 0041. Applied to the live project on 2026-07-13.

create table if not exists public.textbooks (
  id uuid primary key default gen_random_uuid(),
  subject_code text not null,
  title text not null,
  author text not null default '',
  edition text not null default '',
  isbn text not null default '',
  description text not null default '',
  required boolean not null default false,
  cover_url text,
  resource_url text,
  file_path text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_textbooks_subject on public.textbooks (subject_code);

alter table public.textbooks enable row level security;

drop policy if exists "read textbooks" on public.textbooks;
create policy "read textbooks" on public.textbooks
  for select to authenticated using (true);

drop policy if exists "manage textbooks" on public.textbooks;
create policy "manage textbooks" on public.textbooks
  for all to authenticated
  using (
    private.is_admin()
    or exists (
      select 1 from public.subject_enrollments se
      where se.subject_code = textbooks.subject_code
        and se.role = 'instructor'
        and se.user_id = (select auth.uid())
    )
  )
  with check (
    private.is_admin()
    or exists (
      select 1 from public.subject_enrollments se
      where se.subject_code = textbooks.subject_code
        and se.role = 'instructor'
        and se.user_id = (select auth.uid())
    )
  );

-- Public bucket for optional cover images / PDFs; teaching-role uploads land
-- in the uploader's own folder (mirrors the course-files bucket, 0034).
insert into storage.buckets (id, name, public)
values ('textbook-files', 'textbook-files', true)
on conflict (id) do nothing;

drop policy if exists "textbook files teaching insert" on storage.objects;
create policy "textbook files teaching insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'textbook-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('instructor', 'admin')
    )
  );

drop policy if exists "textbook files owner update" on storage.objects;
create policy "textbook files owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'textbook-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "textbook files owner delete" on storage.objects;
create policy "textbook files owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'textbook-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
