-- Threaded discussions (D2L parity): a reply may answer another reply, not
-- just the topic. parent_id is a self-reference on discussion_replies; NULL
-- means a top-level reply to the topic. Cascade so deleting a reply removes
-- its sub-thread. Existing RLS (read all / post own / delete own-or-moderate)
-- already covers the new column — no policy change needed.
--
-- Apply after 0039. Applied to the live project on 2026-07-13.

alter table public.discussion_replies
  add column if not exists parent_id uuid references public.discussion_replies (id) on delete cascade;

create index if not exists idx_discussion_replies_parent
  on public.discussion_replies (parent_id);
