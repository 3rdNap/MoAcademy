-- Per-student module item completion (Canvas-style "mark as done"). Rows are
-- strictly user-owned; a row's existence means the item is complete.
--
-- Apply after 0022. Applied to the live project on 2026-07-11.

create table if not exists public.module_item_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.module_items (id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create index if not exists idx_module_item_progress_user
  on public.module_item_progress (user_id);

alter table public.module_item_progress enable row level security;

drop policy if exists "own progress" on public.module_item_progress;
create policy "own progress" on public.module_item_progress
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
