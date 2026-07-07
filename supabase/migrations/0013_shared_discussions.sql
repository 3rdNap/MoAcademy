-- Real, shared course discussions. Topics/replies are student-generated:
-- anyone signed in can post as themselves, authors manage their own posts,
-- and teaching roles (instructor/admin) can moderate anything. Topics
-- reference the app's course via course_key text (demo courses use text ids).
-- Applied to the live project on 2026-07-05.

create table if not exists public.discussion_topics (
  id uuid primary key default gen_random_uuid(),
  course_key text not null,
  title text not null,
  prompt text not null default '',
  author_id uuid references public.profiles (id) on delete set null,
  author_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_discussion_topics_course
  on public.discussion_topics (course_key);

create table if not exists public.discussion_replies (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.discussion_topics (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_discussion_replies_topic
  on public.discussion_replies (topic_id);

alter table public.discussion_topics enable row level security;
alter table public.discussion_replies enable row level security;

create policy "read discussion topics" on public.discussion_topics
  for select using (true);
create policy "read discussion replies" on public.discussion_replies
  for select using (true);

create policy "post own topics" on public.discussion_topics
  for insert to authenticated with check (author_id = auth.uid());
create policy "post own replies" on public.discussion_replies
  for insert to authenticated with check (author_id = auth.uid());

create policy "delete own or moderate topics" on public.discussion_topics
  for delete to authenticated using (
    author_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('instructor', 'admin')
    )
  );
create policy "delete own or moderate replies" on public.discussion_replies
  for delete to authenticated using (
    author_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('instructor', 'admin')
    )
  );
