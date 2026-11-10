-- =====================================================================
-- Path to Glory · Sponsor stats
-- Anonymous visit counting (site/track.js) and the totals for the Staff
-- desk's Sponsor stats tab. No names or Discord accounts are stored, only a
-- random visitor ID kept in each browser.
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run again. Needs supabase/schema.sql to have been run first.
-- =====================================================================

create table if not exists public.site_events (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visitor    text not null check (char_length(visitor) between 6 and 40),
  session    text not null check (char_length(session) between 6 and 40),
  kind       text not null check (kind in ('visit', 'time', 'section', 'coach', 'char', 'flip', 'discord', 'gcal', 'request', 'day', 'login')),
  target     text not null default '' check (char_length(target) <= 80),
  ms         int  not null default 0 check (ms between 0 and 3600000),
  device     text not null default '' check (device in ('', 'phone', 'tablet', 'computer')),
  tz         text not null default '' check (char_length(tz) <= 60),
  source     text not null default '' check (char_length(source) <= 60),
  logged_in  boolean not null default false
);
create index if not exists site_events_kind_time on public.site_events (kind, created_at);
alter table public.site_events enable row level security;
grant insert on public.site_events to anon, authenticated;
drop policy if exists "site events add" on public.site_events;
create policy "site events add" on public.site_events
  for insert to anon, authenticated with check (true);   -- anyone's visit is counted; nobody can read the rows directly

-- one "top list" for a kind of click: [{name, n, visitors}]
create or replace function public.sponsor_top(k text, lim int default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', target, 'n', n, 'visitors', u) order by n desc), '[]'::jsonb)
  from (select target, count(*) n, count(distinct visitor) u from public.site_events
        where kind = k and target <> '' group by target order by count(*) desc limit lim) t
$$;
revoke execute on function public.sponsor_top(text, int) from public, anon, authenticated;

-- everything the Sponsor stats tab shows, staff only
create or replace function public.sponsor_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  res jsonb;
begin
  if not public.is_staff() then
    raise exception 'Only staff can see sponsor stats.';
  end if;
  with v as (
    select *, (created_at at time zone 'America/New_York') as et from public.site_events where kind = 'visit'
  ), sess as (
    select session, sum(ms) as ms from public.site_events where kind = 'time' group by session
  ), per_visitor as (
    select distinct on (visitor) visitor, device, tz, et from v order by visitor, et
  )
  select jsonb_build_object(
    'visits',             (select count(*) from v),
    'visitors',           (select count(distinct visitor) from v),
    'returning',          (select count(*) from (select visitor from v group by visitor having count(distinct session) > 1) r),
    'logged_in_visitors', (select count(distinct visitor) from v where logged_in),
    'avg_seconds',        (select coalesce(round(avg(ms) / 1000.0), 0) from sess),
    'total_hours',        (select coalesce(round(sum(ms) / 3600000.0, 1), 0) from sess),
    'bounce',             (select case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where ms < 10000) / count(*)) end from sess),
    'days',      (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'visits', n, 'visitors', u) order by d), '[]'::jsonb)
                  from (select et::date d, count(*) n, count(distinct visitor) u from v group by 1) x),
    'new_by_day',(select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb)
                  from (select et::date d, count(*) n from per_visitor group by 1) x),
    'hours',     (select jsonb_agg(jsonb_build_object('h', h, 'visits', coalesce(x.n, 0)) order by h)
                  from generate_series(0, 23) h left join (select extract(hour from et)::int hh, count(*) n from v group by 1) x on x.hh = h),
    'sections',  (select coalesce(jsonb_agg(jsonb_build_object('name', target, 'seconds', s, 'n', n, 'visitors', u) order by s desc), '[]'::jsonb)
                  from (select target, round(sum(ms) / 1000.0) s, count(*) n, count(distinct visitor) u from public.site_events where kind = 'section' group by target) x),
    'coaches',     public.sponsor_top('coach'),
    'chars',       public.sponsor_top('char'),
    'flips',       public.sponsor_top('flip'),
    'discord',     public.sponsor_top('discord'),
    'gcal',        public.sponsor_top('gcal'),
    'requests',    public.sponsor_top('request'),
    'days_opened', public.sponsor_top('day'),
    'logins',      (select count(*) from public.site_events where kind = 'login'),
    'pages',     (select coalesce(jsonb_agg(jsonb_build_object('name', target, 'n', n) order by n desc), '[]'::jsonb)
                  from (select target, count(*) n from v group by target) x),
    'sources',   (select coalesce(jsonb_agg(jsonb_build_object('name', s, 'n', n) order by n desc), '[]'::jsonb)
                  from (select coalesce(nullif(source, ''), 'Direct') s, count(*) n from v group by 1) x),
    'devices',   (select coalesce(jsonb_agg(jsonb_build_object('name', d, 'n', n) order by n desc), '[]'::jsonb)
                  from (select coalesce(nullif(device, ''), 'unknown') d, count(*) n from per_visitor group by 1) x),
    'regions',   (select coalesce(jsonb_agg(jsonb_build_object('name', r, 'n', n) order by n desc), '[]'::jsonb)
                  from (select case split_part(tz, '/', 1) when 'America' then 'Americas' when 'Europe' then 'Europe' when 'Asia' then 'Asia'
                                 when 'Australia' then 'Oceania' when 'Pacific' then 'Oceania' when 'Africa' then 'Africa' else 'Unknown' end r,
                               count(*) n from per_visitor group by 1) x),
    'zones',     (select coalesce(jsonb_agg(jsonb_build_object('name', z, 'n', n) order by n desc), '[]'::jsonb)
                  from (select coalesce(nullif(replace(split_part(tz, '/', -1), '_', ' '), ''), 'Unknown') z, count(*) n
                        from per_visitor group by 1 order by 2 desc limit 12) x),
    'participation', jsonb_build_object(
      'accounts',       (select count(*) from public.profiles),
      'staff',          (select count(*) from public.profiles where role = 'staff'),
      'players',        (select count(distinct m) from public.teams, unnest(member_ids) m),
      'coaches_linked', (select count(*) from public.coaches where profile_id is not null),
      'requested',      (select count(*) from public.requests where not by_coach),
      'booked',         (select count(*) from public.requests where status = 'accepted'),
      'coach_hours',    (select coalesce(round(sum(extract(epoch from ends_at - starts_at)) / 3600.0, 1), 0) from public.availability))
  ) into res;
  return res;
end $$;
revoke execute on function public.sponsor_stats() from public, anon;
grant execute on function public.sponsor_stats() to authenticated;
