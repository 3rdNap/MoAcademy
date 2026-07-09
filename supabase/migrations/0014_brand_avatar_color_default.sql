-- The profiles.avatar_color default was the pre-rebrand purple; align it with
-- the MoAcademy logo blue so new signups get an on-brand avatar. Also refresh
-- any existing rows still carrying the old purple.
-- Applied to the live project on 2026-07-09.

alter table public.profiles
  alter column avatar_color set default '#0284c7';

update public.profiles
  set avatar_color = '#0284c7'
  where avatar_color = '#5d3fea';
