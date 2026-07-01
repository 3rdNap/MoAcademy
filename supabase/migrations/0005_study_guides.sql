-- MoAcademy study guides
-- Metadata table for the library in src/app/study-guides. The PDF and thumbnail
-- files live in a Supabase Storage bucket named 'study-guides'; these columns
-- store their object paths (or external URLs). Until this is wired, the app
-- keeps guides in the browser.

create table if not exists public.study_guides (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete cascade,
  title text not null,
  subject text not null default '',
  description text not null default '',
  pdf_path text,   -- storage object path or external URL
  thumb_path text, -- storage object path or external URL
  created_at timestamptz not null default now()
);

create index if not exists idx_study_guides_owner on public.study_guides (owner_id);

alter table public.study_guides enable row level security;

-- Guides are readable by everyone; owners manage their own.
create policy "read study guides" on public.study_guides
  for select using (true);
create policy "own study guides" on public.study_guides
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Storage setup (run once in the dashboard or via the CLI):
--   1. Create a public bucket named 'study-guides'.
--   2. Add storage policies so authenticated users can upload to their own
--      folder and everyone can read. Example (Storage > Policies):
--        - SELECT: bucket_id = 'study-guides'
--        - INSERT/UPDATE/DELETE: bucket_id = 'study-guides'
--            AND auth.uid()::text = (storage.foldername(name))[1]
