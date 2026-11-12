-- Path to Glory · two more Session settings for coaches, and Lumi-chan's "session soon" pings.
--
--   coaches.notice_minutes   how far ahead players must request (default 1 hour). Stops requests
--                            for "20 minutes from now" that the coach can't get ready for.
--                            Sessions a mentor writes down themselves aren't limited by it.
--   coaches.ping_minutes     how long before a booked session Lumi-chan DMs the coach (mentors
--                            and assistants; default 20 minutes; 0 = off).
--   ptg_pings                one row per ping Lumi-chan sent, so she never pings twice for the
--                            same session (a moved session gets a fresh ping at its new time).
--                            Only Lumi-chan writes it, over her own database connection.
--
-- Safe to run more than once. Run it before pushing the site code that uses it.

-- Any amount the coach types, from 0 up to 1 day (1440 minutes).
alter table public.coaches add column if not exists notice_minutes int not null default 60;
alter table public.coaches add column if not exists ping_minutes int not null default 20;
alter table public.coaches drop constraint if exists coaches_notice_minutes_check;
alter table public.coaches drop constraint if exists coaches_ping_minutes_check;
alter table public.coaches add constraint coaches_notice_minutes_check check (notice_minutes between 0 and 1440);
alter table public.coaches add constraint coaches_ping_minutes_check check (ping_minutes between 0 and 1440);

-- A number of minutes in words: 45 → "45 minutes", 60 → "1 hour", 90 → "1 hour 30 minutes", 1440 → "1 day".
create or replace function public.minutes_words(m int) returns text
language sql immutable as $$
  select case
    when m >= 1440 then '1 day'
    when m < 60 then m || ' minute' || case when m = 1 then '' else 's' end
    else (m / 60) || ' hour' || case when m / 60 = 1 then '' else 's' end
         || case when m % 60 > 0 then ' ' || (m % 60) || ' minute' || case when m % 60 = 1 then '' else 's' end else '' end
  end
$$;

create table if not exists public.ptg_pings (
  request_id uuid not null references public.requests(id) on delete cascade,
  starts_at  timestamptz not null,           -- the session time that was pinged
  sent_at    timestamptz not null default now(),
  primary key (request_id, starts_at)
);
alter table public.ptg_pings enable row level security;   -- no policies: the website can't read or write it

-- Session settings now carry the two new answers. Left out (null), they stay as they are,
-- so an older copy of the site that only sends the first four still works.
drop function if exists public.save_session_settings(text, int, int, text);
create or replace function public.save_session_settings(c text, mn int, mx int, k text, nt int default null, pm int default null)
returns public.coaches
language plpgsql security definer set search_path = public as $$
declare
  row_out public.coaches;
begin
  if not public.is_staff() and not exists (select 1 from public.coaches where id = c and profile_id = auth.uid()) then
    raise exception 'You don''t have permission to do that.';
  end if;
  if mn > mx then
    raise exception 'The shortest session can''t be longer than the longest.';
  end if;
  if nt not between 0 and 1440 or pm not between 0 and 1440 then
    raise exception 'Pick a time between 0 minutes and 1 day.';
  end if;
  update public.coaches
     set min_minutes = mn, max_minutes = mx, session_kinds = k,
         notice_minutes = coalesce(nt, notice_minutes), ping_minutes = coalesce(pm, ping_minutes)
   where id = c returning * into row_out;
  return row_out;
end $$;

-- Requests: the same rules as before, plus the coach's notice.
create or replace function public.requests_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  k text;
  mn int;
  mx int;
  ks text;
  nt int;
begin
  if current_setting('ptg.writing_session', true) = 'on' then
    return new;   -- write_session checked everything itself
  end if;
  if auth.uid() is not null then
    new.requester_id := auth.uid();
  end if;
  new.status := 'pending';
  new.decided_at := null;
  if new.ends_at - new.starts_at < interval '30 minutes' or new.ends_at - new.starts_at > interval '2 hours' then
    raise exception 'Sessions run from 30 minutes to 2 hours.';
  end if;

  select kind, min_minutes, max_minutes, session_kinds, notice_minutes into k, mn, mx, ks, nt
    from public.coaches where id = new.coach_id;
  if k is null then
    raise exception 'That coach doesn''t exist.';
  end if;
  if new.ends_at - new.starts_at < make_interval(mins => mn) or new.ends_at - new.starts_at > make_interval(mins => mx) then
    raise exception 'That length is outside what this coach takes.';
  end if;
  if ks <> 'both' and ks <> new.kind then
    raise exception 'This coach doesn''t take that kind of session.';
  end if;
  -- only players request sessions: coaches (mentors and assistants) and staff can't, unless they're on a team
  -- or marked "student too" (profiles.is_student, from student-access.sql)
  if (exists (select 1 from public.coaches c where c.profile_id = new.requester_id)
      or exists (select 1 from public.profiles p where p.id = new.requester_id and p.role = 'staff'))
     and not exists (select 1 from public.teams t where new.requester_id = any (t.member_ids))
     and not exists (select 1 from public.profiles p where p.id = new.requester_id and p.is_student) then
    raise exception 'Only players can request sessions.';
  end if;
  if new.starts_at < now() then
    raise exception 'That time has already passed.';
  end if;
  if new.starts_at < now() + make_interval(mins => coalesce(nt, 60)) then
    raise exception 'This coach takes requests up to % before a session. Pick a later time.', public.minutes_words(coalesce(nt, 60));
  end if;
  if not exists (
    select 1 from public.availability a
    where a.coach_id = new.coach_id and a.starts_at <= new.starts_at and a.ends_at >= new.ends_at
  ) then
    raise exception 'That time is outside the hours this coach posted.';
  end if;
  if exists (
    select 1 from public.requests r
    where r.coach_id = new.coach_id and r.status = 'accepted'
      and tstzrange(r.starts_at, r.ends_at) && tstzrange(new.starts_at, new.ends_at)
  ) then
    raise exception 'That time is already booked.';
  end if;
  if (select count(*) from public.requests r
      where r.requester_id = new.requester_id and r.status = 'pending') >= 5 then
    raise exception 'You already have 5 requests waiting. Cancel one or wait for answers.';
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';

-- check: notice_minutes, ping_minutes, ptg_pings, "student too" kept in the request rule,
-- then one row per account marked "student too" (none = no rows after the first four)
select 'coaches.' || column_name || ' (default ' || column_default || ')' as part from information_schema.columns
  where table_schema = 'public' and table_name = 'coaches' and column_name in ('notice_minutes', 'ping_minutes')
union all
select 'ptg_pings table' from information_schema.tables where table_schema = 'public' and table_name = 'ptg_pings'
union all
select 'request rule allows student too: ' || (position('is_student' in pg_get_functiondef('public.requests_before_insert()'::regprocedure)) > 0)::text
union all
select 'student too: ' || coalesce(nullif(p.display_name, ''), p.username, '?')
       || coalesce(' (' || (select c.id || ' ' || c.name from public.coaches c where c.profile_id = p.id limit 1) || ')', '')
       || case when p.role = 'staff' then ' [staff]' else '' end
  from public.profiles p where p.is_student;
