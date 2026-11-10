-- =====================================================================
-- Path to Glory · Team & player stats (Staff desk → Team stats)
-- From now on a logged-in visitor's time and clicks are saved with their
-- account, so staff can see each player's time on the site. Visitors who
-- aren't logged in stay anonymous, as before.
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run again. Needs supabase/sponsor-stats.sql to have been run first.
-- =====================================================================

-- who the visit belongs to (only when they were logged in; blank otherwise)
alter table public.site_events add column if not exists profile_id uuid references public.profiles(id) on delete set null;
create index if not exists site_events_profile on public.site_events (profile_id) where profile_id is not null;

-- a row can only carry your own account, never someone else's
drop policy if exists "site events add" on public.site_events;
create policy "site events add" on public.site_events
  for insert to anon, authenticated
  with check (profile_id is null or profile_id = auth.uid());

-- one entry per logged-in person who has been tracked, staff only:
-- [{profile_id, visits, seconds, last_seen, sections:[{name, seconds}], coaches:[{name, n}], chars:[{name, n}], days:[{day, seconds}]}]
create or replace function public.staff_player_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  res jsonb;
begin
  if not public.is_staff() then
    raise exception 'Only staff can see player stats.';
  end if;
  with e as (
    select * from public.site_events where profile_id is not null
  ), people as (
    select distinct profile_id from e
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'profile_id', p.profile_id,
    'visits',    (select count(*) from e where e.profile_id = p.profile_id and kind = 'visit'),
    'seconds',   (select coalesce(round(sum(ms) / 1000.0), 0) from e where e.profile_id = p.profile_id and kind = 'time'),
    'last_seen', (select max(created_at) from e where e.profile_id = p.profile_id),
    'sections',  (select coalesce(jsonb_agg(jsonb_build_object('name', target, 'seconds', s) order by s desc), '[]'::jsonb)
                  from (select target, round(sum(ms) / 1000.0) s from e where e.profile_id = p.profile_id and kind = 'section' group by target) x),
    'coaches',   (select coalesce(jsonb_agg(jsonb_build_object('name', target, 'n', n) order by n desc), '[]'::jsonb)
                  from (select target, count(*) n from e where e.profile_id = p.profile_id and kind in ('coach', 'flip') and target <> '' group by target) x),
    'chars',     (select coalesce(jsonb_agg(jsonb_build_object('name', target, 'n', n) order by n desc), '[]'::jsonb)
                  from (select target, count(*) n from e where e.profile_id = p.profile_id and kind = 'char' and target <> '' group by target) x),
    'days',      (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'seconds', s) order by d), '[]'::jsonb)
                  from (select (created_at at time zone 'America/New_York')::date d, round(sum(ms) / 1000.0) s
                        from e where e.profile_id = p.profile_id and kind = 'time' group by 1) x)
  )), '[]'::jsonb) into res
  from people p;
  return res;
end $$;
revoke execute on function public.staff_player_stats() from public, anon;
grant execute on function public.staff_player_stats() to authenticated;

notify pgrst, 'reload schema';

-- check: the new column is there (expect one row, "profile_id")
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'site_events' and column_name = 'profile_id';
