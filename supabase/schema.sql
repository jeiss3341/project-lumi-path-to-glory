-- =====================================================================
-- Path to Glory · Supabase schema
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- It is safe to run again after edits (tables use IF NOT EXISTS,
-- functions are replaced, policies are dropped and re-created).
--
-- Who can do what (enforced here, not in the browser):
--   anyone            reads coaches, teams, posted hours, busy times
--   signed-in player  requests sessions, cancels own
--   mentor / assist.  posts own hours, accepts or declines own requests; mentors write down sessions
--                     they set up with their own team (write_session)
--   staff             links coaches to Discord accounts, edits mentor files, sets roles,
--                     sees every session (teams are set by the organiser, read only on the site)
-- =====================================================================

create extension if not exists btree_gist;

-- Optional: Discord pings through a webhook (see the end of this file).
do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net is not available, so Discord pings stay off.';
end $$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- One row per Discord account that has logged in (filled by a trigger).
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  discord_id   text,
  username     text,
  display_name text,
  avatar_url   text,
  role         text not null default 'player' check (role in ('player', 'staff')),
  created_at   timestamptz not null default now()
);

-- The 8 mentor slots and the assistant / role coach slots.
create table if not exists public.coaches (
  id             text primary key,                 -- m1..m8, a1..a4
  kind           text not null check (kind in ('mentor', 'assistant')),
  slot           int  not null,
  badge_id       text not null,                    -- INS-0471-RX
  profile_id     uuid unique references public.profiles(id) on delete set null,
  name           text not null default '' check (char_length(name) <= 40),
  team_name      text not null default '' check (char_length(team_name) <= 40),
  focus          text not null default '' check (char_length(focus) <= 80),
  main_character text not null default '' check (char_length(main_character) <= 40),
  display_skin   text not null default '' check (char_length(display_skin) <= 60),
  pool           text[] not null default '{}' check (cardinality(pool) <= 8),
  playstyle      text not null default '' check (char_length(playstyle) <= 400),
  history        text[] not null default '{}' check (cardinality(history) <= 8),
  about          text not null default '' check (char_length(about) <= 600),
  updated_at     timestamptz not null default now()
);

-- What each coach takes (their Session settings). The defaults are the event's normal rules.
alter table public.coaches add column if not exists min_minutes int not null default 30 check (min_minutes in (30, 60, 90, 120));
alter table public.coaches add column if not exists max_minutes int not null default 120 check (max_minutes in (30, 60, 90, 120));
alter table public.coaches add column if not exists art_fit jsonb;   -- staff's position and size for the card picture
alter table public.coaches add column if not exists art_url text;   -- a picture staff uploaded; blank uses the starting art
alter table public.coaches add column if not exists head_fit jsonb;   -- the same two settings for the small assistant icon
alter table public.coaches add column if not exists head_url text;
alter table public.coaches add column if not exists session_kinds text not null default 'both' check (session_kinds in ('both', 'team', 'individual'));

-- Event teams. Signups happen on Google Forms and Discord; the organiser enters the final teams here
-- (read only from the site, staff can't change them).
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) <= 40),
  coach_id   text references public.coaches(id) on delete set null,
  players    jsonb not null default '[]'::jsonb check (jsonb_typeof(players) = 'array'),
  member_ids uuid[] not null default '{}',   -- logged-in accounts on this team
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
-- Checkpoint placements (1 = won), set by the organiser after each checkpoint. The rosters page unlocks
-- its Standings view once any team has a mock placement, and shows final standings after that.
alter table public.teams add column if not exists mock_place  smallint check (mock_place  between 1 and 99);
alter table public.teams add column if not exists final_place smallint check (final_place between 1 and 99);
-- Team profile: basic information from the signup form as label → answer pairs,
-- e.g. {"Captain": "…", "Region": "NA"}.
alter table public.teams add column if not exists info jsonb not null default '{}'::jsonb check (jsonb_typeof(info) = 'object');

-- Hours a coach is free: one row per block (hour in → hour out).
-- Blocks sit inside one event day: 8:00 AM to 4:00 AM the next morning, Eastern (see availability_window).
create table if not exists public.availability (
  id         uuid primary key default gen_random_uuid(),
  coach_id   text not null references public.coaches(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '20 hours'),
  constraint availability_no_overlap
    exclude using gist (coach_id with =, tstzrange(starts_at, ends_at) with &&)
);

-- Session requests. A coach accepts or declines each one.
create table if not exists public.requests (
  id           uuid primary key default gen_random_uuid(),
  coach_id     text not null references public.coaches(id) on delete cascade,
  requester_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind         text not null check (kind in ('team', 'individual')),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  note         text not null default '' check (char_length(note) <= 500),
  status       text not null default 'pending'
               check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  decided_at   timestamptz,
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at),
  constraint requests_no_double_booking
    exclude using gist (coach_id with =, tstzrange(starts_at, ends_at) with &&) where (status = 'accepted')
);

-- A session the mentor wrote down (set up with their own team, on Discord say), booked straight away by
-- write_session, rather than requested by a player. A team review is under the mentor's own account and every
-- player on the team can see it; an individual session is under that player.
alter table public.requests add column if not exists by_coach boolean not null default false;

-- Sessions run from 30 minutes to 4 hours (players can only request up to 2: see requests_before_insert).
-- This also replaces the old 2-hour limit on databases set up before written sessions.
do $$
declare n text;
begin
  for n in select conname from pg_constraint
            where conrelid = 'public.requests'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%02:00:00%' loop
    execute format('alter table public.requests drop constraint %I', n);
  end loop;
end $$;
alter table public.requests drop constraint if exists requests_length;
alter table public.requests add constraint requests_length
  check (ends_at - starts_at between interval '30 minutes' and interval '4 hours');

create index if not exists requests_coach_idx on public.requests (coach_id, starts_at);
create index if not exists requests_requester_idx on public.requests (requester_id, starts_at);
create index if not exists availability_coach_idx on public.availability (coach_id, starts_at);

-- Private settings (not reachable from the website).
create schema if not exists private;
create table if not exists private.settings (
  key   text primary key,
  value text not null
);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'staff');
$$;

create or replace function public.is_coach(c text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coaches where id = c and profile_id = auth.uid());
$$;

-- Busy times for one coach, without saying who asked.
create or replace function public.coach_busy(c text)
returns table (starts_at timestamptz, ends_at timestamptz, status text)
language sql stable security definer set search_path = public as $$
  select r.starts_at, r.ends_at, r.status
  from public.requests r
  where r.coach_id = c and r.status in ('pending', 'accepted') and r.ends_at > now() - interval '1 day'
  order by r.starts_at;
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

-- New Discord login → profile row.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, discord_id, username, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'provider_id',
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'), '#0$', ''),   -- Discord's new usernames come as "name#0"
    coalesce(new.raw_user_meta_data -> 'custom_claims' ->> 'global_name',
             regexp_replace(new.raw_user_meta_data ->> 'full_name', '#0$', ''),
             regexp_replace(new.raw_user_meta_data ->> 'name', '#0$', '')),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep name and avatar fresh on later logins.
create or replace function public.handle_user_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set
    username     = coalesce(regexp_replace(new.raw_user_meta_data ->> 'name', '#0$', ''), username),
    display_name = coalesce(new.raw_user_meta_data -> 'custom_claims' ->> 'global_name', display_name),
    avatar_url   = coalesce(new.raw_user_meta_data ->> 'avatar_url', avatar_url)
  where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of raw_user_meta_data on auth.users
  for each row execute function public.handle_user_update();

-- Only staff edit coach slots and mentor files (see the "coaches update" policy). This guard is a
-- second lock on the slot fields and keeps updated_at current.
create or replace function public.coaches_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_staff() then
    if new.id <> old.id or new.kind <> old.kind or new.slot <> old.slot
       or new.badge_id <> old.badge_id or new.profile_id is distinct from old.profile_id then
      raise exception 'Only staff can change coach slots or who a slot is linked to.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists coaches_guard on public.coaches;
create trigger coaches_guard before update on public.coaches
  for each row execute function public.coaches_guard();

-- A coach can't delete hours that have a booked session or a waiting request in them: it has to be declined or
-- cancelled first. (save_hours and remove_hours switch this off for their own deletes, after the same check.)
create or replace function public.availability_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('ptg.saving_hours', true) = 'on' then
    return old;
  end if;
  if exists (
    select 1 from public.requests r
    where r.coach_id = old.coach_id
      and (r.status = 'accepted' or (r.status = 'pending' and r.starts_at > now()))
      and r.starts_at >= old.starts_at and r.ends_at <= old.ends_at
  ) then
    raise exception 'These hours have a session or a waiting request in them. Decline or cancel it first.';
  end if;
  return old;
end $$;

drop trigger if exists availability_guard on public.availability;
create trigger availability_guard before delete on public.availability
  for each row execute function public.availability_guard();

-- Posted hours stay inside one event day: 8:00 AM to 4:00 AM the next morning, Eastern time.
-- (An event day runs 4 AM to 4 AM Eastern, so 1 AM counts as the evening before.)
create or replace function public.availability_window() returns trigger
language plpgsql set search_path = public as $$
declare
  s   timestamp := new.starts_at at time zone 'America/New_York';
  e   timestamp := new.ends_at   at time zone 'America/New_York';
  day timestamp := date_trunc('day', s - interval '4 hours');
begin
  if s < day + interval '8 hours' or e > day + interval '28 hours' then
    raise exception 'Hours have to be between 8 AM and 4 AM Eastern.';
  end if;
  return new;
end $$;

drop trigger if exists availability_window on public.availability;
create trigger availability_window before insert or update on public.availability
  for each row execute function public.availability_window();

-- Post new hours (b = null) or change a block (b = its id), all in one step:
-- the hours join every block they overlap or touch, and booked sessions and waiting requests must stay inside.
create or replace function public.save_hours(c text, b uuid, s timestamptz, e timestamptz)
returns public.availability
language plpgsql security definer set search_path = public as $$
declare
  s2 timestamptz := s;
  e2 timestamptz := e;
  ms timestamptz;
  me timestamptz;
  n  int;
  saved public.availability;
begin
  if not (public.is_staff() or public.is_coach(c)) then
    raise exception 'You don''t have permission to do that.';
  end if;
  if e <= s then
    raise exception 'Hour out has to be after hour in.';
  end if;
  if b is not null and not exists (select 1 from public.availability where id = b and coach_id = c) then
    raise exception 'Those hours don''t exist anymore.';
  end if;
  -- grow to cover every block it overlaps or touches, until nothing more joins
  loop
    select count(*), min(a.starts_at), max(a.ends_at) into n, ms, me
      from public.availability a
     where a.coach_id = c and a.id is distinct from b
       and a.starts_at <= e2 and a.ends_at >= s2
       and (a.starts_at < s2 or a.ends_at > e2);
    exit when n = 0;
    s2 := least(s2, ms);
    e2 := greatest(e2, me);
  end loop;
  -- every booked session and waiting request in the hours being replaced has to fit in the new hours
  if exists (
    select 1 from public.requests r
     where r.coach_id = c
       and (r.status = 'accepted' or (r.status = 'pending' and r.starts_at > now()))
       and not (r.starts_at >= s2 and r.ends_at <= e2)
       and exists (select 1 from public.availability a
                    where a.coach_id = c and (a.id = b or (a.starts_at <= e2 and a.ends_at >= s2))
                      and r.starts_at >= a.starts_at and r.ends_at <= a.ends_at)
  ) then
    raise exception 'A session or waiting request would be outside the new hours. Decline or cancel it first, or keep it inside.';
  end if;
  perform set_config('ptg.saving_hours', 'on', true);
  delete from public.availability a where a.coach_id = c and (a.id = b or (a.starts_at <= e2 and a.ends_at >= s2));
  perform set_config('ptg.saving_hours', 'off', true);
  insert into public.availability (coach_id, starts_at, ends_at) values (c, s2, e2) returning * into saved;
  return saved;
end $$;

-- Take a stretch of time out of a coach's hours (the mentor calendar's Remove hours): blocks it cuts through
-- are split around it. Not while a booked session or a waiting request is in that time.
create or replace function public.remove_hours(c text, s timestamptz, e timestamptz)
returns void
language plpgsql security definer set search_path = public as $$
declare
  a public.availability;
begin
  if not (public.is_staff() or public.is_coach(c)) then
    raise exception 'You don''t have permission to do that.';
  end if;
  if e <= s then
    raise exception 'Hour out has to be after hour in.';
  end if;
  if exists (select 1 from public.requests r
              where r.coach_id = c and r.starts_at < e and r.ends_at > s
                and (r.status = 'accepted' or (r.status = 'pending' and r.starts_at > now()))) then
    raise exception 'A session or waiting request is in those hours. Decline or cancel it first.';
  end if;
  perform set_config('ptg.saving_hours', 'on', true);
  for a in select * from public.availability where coach_id = c and starts_at < e and ends_at > s loop
    delete from public.availability where id = a.id;
    if a.starts_at < s then
      insert into public.availability (coach_id, starts_at, ends_at) values (c, a.starts_at, s);
    end if;
    if a.ends_at > e then
      insert into public.availability (coach_id, starts_at, ends_at) values (c, e, a.ends_at);
    end if;
  end loop;
  perform set_config('ptg.saving_hours', 'off', true);
end $$;

-- Validate a new request: inside posted hours, not booked, not in the past.
create or replace function public.requests_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  k text;
  mn int;
  mx int;
  ks text;
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

  select kind, min_minutes, max_minutes, session_kinds into k, mn, mx, ks from public.coaches where id = new.coach_id;
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
  if (exists (select 1 from public.coaches c where c.profile_id = new.requester_id)
      or exists (select 1 from public.profiles p where p.id = new.requester_id and p.role = 'staff'))
     and not exists (select 1 from public.teams t where new.requester_id = any (t.member_ids)) then
    raise exception 'Only players can request sessions.';
  end if;
  if new.starts_at < now() then
    raise exception 'That time has already passed.';
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

drop trigger if exists requests_before_insert on public.requests;
create trigger requests_before_insert before insert on public.requests
  for each row execute function public.requests_before_insert();

-- A mentor writes down a session they set up with their own team (on Discord, say), so every session is on the
-- site. It's booked straight away (by_coach = true), inside their hours. k = 'team' is for the whole team (p is
-- left null) and shows on all their desks; k = 'individual' is with player p. Waiting requests at the same time
-- are declined, as when accepting one.
-- A coach answers their own Session settings (staff can too).
create or replace function public.save_session_settings(c text, mn int, mx int, k text)
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
  update public.coaches set min_minutes = mn, max_minutes = mx, session_kinds = k where id = c returning * into row_out;
  return row_out;
end $$;

create or replace function public.write_session(c text, p uuid, k text, s timestamptz, e timestamptz, n text default '')
returns public.requests
language plpgsql security definer set search_path = public as $$
declare
  saved public.requests;
  who   uuid := p;
begin
  if not (public.is_staff() or public.is_coach(c)) then
    raise exception 'You don''t have permission to do that.';
  end if;
  if not exists (select 1 from public.teams t where t.coach_id = c) then
    raise exception 'Only mentors with a team can write sessions.';
  end if;
  if k is null or k not in ('team', 'individual') then
    raise exception 'Pick team review or individual.';
  end if;
  if k = 'team' then
    select profile_id into who from public.coaches where id = c;
    if who is null then
      raise exception 'This mentor slot isn''t linked to a Discord account yet.';
    end if;
  elsif p is null or not exists (select 1 from public.teams t where t.coach_id = c and p = any (t.member_ids)) then
    raise exception 'You can only write sessions for players on your own team.';
  end if;
  if e - s < interval '30 minutes' or e - s > interval '4 hours' then
    raise exception 'Written sessions run from 30 minutes to 4 hours.';
  end if;
  if s < now() then
    raise exception 'That time has already passed.';
  end if;
  if not exists (select 1 from public.availability a
                  where a.coach_id = c and a.starts_at <= s and a.ends_at >= e) then
    raise exception 'That time is outside your posted hours.';
  end if;
  if exists (select 1 from public.requests r
              where r.coach_id = c and r.status = 'accepted'
                and tstzrange(r.starts_at, r.ends_at) && tstzrange(s, e)) then
    raise exception 'That time is already booked.';
  end if;
  update public.requests set status = 'declined'
   where coach_id = c and status = 'pending' and tstzrange(starts_at, ends_at) && tstzrange(s, e);
  perform set_config('ptg.writing_session', 'on', true);
  insert into public.requests (coach_id, requester_id, kind, starts_at, ends_at, note, status, decided_at, by_coach)
  values (c, who, k, s, e, left(coalesce(n, ''), 500), 'accepted', now(), true)
  returning * into saved;
  perform set_config('ptg.writing_session', 'off', true);
  return saved;
end $$;

-- Only the status changes, and only in allowed ways.
create or replace function public.requests_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('ptg.moving_request', true) = 'on' then
    return new;   -- move_request checked everything itself
  end if;
  if new.coach_id <> old.coach_id or new.requester_id <> old.requester_id
     or new.starts_at <> old.starts_at or new.ends_at <> old.ends_at
     or new.kind <> old.kind or new.note <> old.note or new.by_coach <> old.by_coach then
    raise exception 'Only a request''s status can change.';
  end if;
  if new.status = old.status then
    return new;
  end if;
  if auth.uid() is null or public.is_staff() then
    null;
  elsif public.is_coach(old.coach_id) and old.status = 'pending' and new.status in ('accepted', 'declined') then
    null;
  elsif public.is_coach(old.coach_id) and old.status = 'accepted' and new.status = 'cancelled' then
    null;
  elsif old.requester_id = auth.uid() and old.status in ('pending', 'accepted') and new.status = 'cancelled' then
    null;
  else
    raise exception 'You can''t change this request.';
  end if;
  new.decided_at := now();
  return new;
end $$;

drop trigger if exists requests_before_update on public.requests;
create trigger requests_before_update before update on public.requests
  for each row execute function public.requests_before_update();

-- A coach (or staff) moves a waiting request or booked session to a new time. moved_at lets the player's desk
-- show "Moved", and notify_discord pings the player.
alter table public.requests add column if not exists moved_at timestamptz;

create or replace function public.move_request(r uuid, s timestamptz, e timestamptz) returns public.requests
language plpgsql security definer set search_path = public as $$
declare
  q public.requests;
begin
  select * into q from public.requests where id = r for update;
  if q.id is null then
    raise exception 'That request doesn''t exist.';
  end if;
  if not (public.is_coach(q.coach_id) or public.is_staff()) then
    raise exception 'Only the coach can move this session.';
  end if;
  if q.status not in ('pending', 'accepted') then
    raise exception 'Only waiting requests and booked sessions can be moved.';
  end if;
  if e - s < interval '30 minutes' or e - s > interval '4 hours' then
    raise exception 'Sessions run from 30 minutes to 4 hours.';
  end if;
  if s < now() then
    raise exception 'That time has already passed.';
  end if;
  if not exists (select 1 from public.availability a
                 where a.coach_id = q.coach_id and a.starts_at <= s and a.ends_at >= e) then
    raise exception 'Pick a time inside your posted hours.';
  end if;
  if exists (select 1 from public.requests x
             where x.coach_id = q.coach_id and x.id <> q.id and x.status = 'accepted'
               and tstzrange(x.starts_at, x.ends_at) && tstzrange(s, e)) then
    raise exception 'That time is already booked.';
  end if;
  perform set_config('ptg.moving_request', 'on', true);
  update public.requests set starts_at = s, ends_at = e, moved_at = now() where id = r returning * into q;
  perform set_config('ptg.moving_request', 'off', true);
  -- a booked session that moves onto waiting requests declines them, like accepting does
  if q.status = 'accepted' then
    update public.requests set status = 'declined'
    where coach_id = q.coach_id and status = 'pending' and id <> q.id
      and tstzrange(starts_at, ends_at) && tstzrange(s, e);
  end if;
  return q;
end $$;
grant execute on function public.move_request(uuid, timestamptz, timestamptz) to authenticated;

-- Accepting one request declines the others that overlap it.
create or replace function public.requests_after_accept() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    update public.requests set status = 'declined'
    where coach_id = new.coach_id and status = 'pending' and id <> new.id
      and tstzrange(starts_at, ends_at) && tstzrange(new.starts_at, new.ends_at);
  end if;
  return null;
end $$;

drop trigger if exists requests_after_accept on public.requests;
create trigger requests_after_accept after update on public.requests
  for each row execute function public.requests_after_accept();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.coaches      enable row level security;
alter table public.teams        enable row level security;
alter table public.availability enable row level security;
alter table public.requests     enable row level security;

-- profiles
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
  for select to authenticated using (true);
drop policy if exists "profiles staff update" on public.profiles;
create policy "profiles staff update" on public.profiles
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- card pictures staff upload: anyone can view them, only staff can add them, and files are never replaced
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-art', 'card-art', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "card art staff upload" on storage.objects;
create policy "card art staff upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'card-art' and public.is_staff());

-- coaches
drop policy if exists "coaches read" on public.coaches;
create policy "coaches read" on public.coaches
  for select to anon, authenticated using (true);
drop policy if exists "coaches update" on public.coaches;
create policy "coaches update" on public.coaches
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());
drop policy if exists "coaches staff insert" on public.coaches;
create policy "coaches staff insert" on public.coaches
  for insert to authenticated with check (public.is_staff());
drop policy if exists "coaches staff delete" on public.coaches;
create policy "coaches staff delete" on public.coaches
  for delete to authenticated using (public.is_staff());

-- teams
drop policy if exists "teams read" on public.teams;
create policy "teams read" on public.teams
  for select to anon, authenticated using (true);
-- Teams are read only from the site: the organiser sets teams, players, linked accounts and
-- checkpoint placements directly in the database (see the starting data at the end of this file).
drop policy if exists "teams staff write" on public.teams;
drop policy if exists "teams staff update" on public.teams;

-- availability
drop policy if exists "availability read" on public.availability;
create policy "availability read" on public.availability
  for select to anon, authenticated using (true);
drop policy if exists "availability write" on public.availability;
create policy "availability write" on public.availability
  for all to authenticated
  using (public.is_staff() or public.is_coach(coach_id))
  with check (public.is_staff() or public.is_coach(coach_id));

-- requests
drop policy if exists "requests read" on public.requests;
create policy "requests read" on public.requests
  for select to authenticated
  using (requester_id = auth.uid() or public.is_coach(coach_id) or public.is_staff()
         or (by_coach and kind = 'team' and exists (select 1 from public.teams t
              where t.coach_id = requests.coach_id and auth.uid() = any (t.member_ids))));   -- team reviews the mentor wrote
drop policy if exists "requests insert" on public.requests;
create policy "requests insert" on public.requests
  for insert to authenticated with check (requester_id = auth.uid());
drop policy if exists "requests update" on public.requests;
create policy "requests update" on public.requests
  for update to authenticated
  using (requester_id = auth.uid() or public.is_coach(coach_id) or public.is_staff())
  with check (requester_id = auth.uid() or public.is_coach(coach_id) or public.is_staff());
drop policy if exists "requests staff delete" on public.requests;
create policy "requests staff delete" on public.requests
  for delete to authenticated using (public.is_staff());

-- Live updates for the calendars.
do $$ begin
  alter publication supabase_realtime add table public.requests;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.availability;
exception when others then null; end $$;

-- ---------------------------------------------------------------------
-- Optional: Discord pings
-- Pings the mentor when a request arrives, and the player when it's
-- answered, through a channel webhook. Discord renders the <t:…> times in
-- each reader's own time zone. To turn it on, run (with your webhook URL):
--   insert into private.settings (key, value)
--   values ('discord_webhook_url', 'https://discord.com/api/webhooks/…')
--   on conflict (key) do update set value = excluded.value;
-- ---------------------------------------------------------------------

create or replace function public.notify_discord() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hook  text;
  cname text;
  cping text;
  pname text;
  pping text;
  t1    bigint := extract(epoch from new.starts_at)::bigint;
  t2    bigint := extract(epoch from new.ends_at)::bigint;
  msg   text;
  ping  text;
begin
  select value into hook from private.settings where key = 'discord_webhook_url';
  if coalesce(hook, '') = '' then
    return null;
  end if;
  select coalesce(nullif(c.name, ''), 'a coach'), p.discord_id into cname, cping
    from public.coaches c left join public.profiles p on p.id = c.profile_id
    where c.id = new.coach_id;
  select coalesce(display_name, username, 'A player'), discord_id into pname, pping
    from public.profiles where id = new.requester_id;

  if tg_op = 'INSERT' and new.by_coach and new.kind = 'team' then
    msg := format('%s booked a team review: <t:%s:F> to <t:%s:t>. It''s on your team''s desks.', cname, t1, t2);
    ping := null;
  elsif tg_op = 'INSERT' and new.by_coach then
    msg := format('%s booked an individual session with you: <t:%s:F> to <t:%s:t>. It''s on your desk.', cname, t1, t2);
    ping := pping;
  elsif tg_op = 'INSERT' then
    msg := format('New %s session request for %s: <t:%s:F> to <t:%s:t>, from %s. Accept or decline it on your mentor desk.',
                  new.kind, cname, t1, t2, pname);
    ping := cping;
  elsif new.status <> old.status and new.status in ('accepted', 'declined') then
    msg := format('%s %s your %s session request for <t:%s:F> to <t:%s:t>.', cname, new.status, new.kind, t1, t2);
    ping := pping;
  elsif new.status <> old.status and new.status = 'cancelled' then
    msg := format('The %s session with %s on <t:%s:F> was cancelled.', new.kind, cname, t1);
    ping := case when new.by_coach and new.kind = 'team' then null when public.is_coach(new.coach_id) then pping else cping end;
  elsif new.starts_at <> old.starts_at or new.ends_at <> old.ends_at then
    msg := format('%s moved your %s session to <t:%s:F> to <t:%s:t>. The new time is on your desk.', cname, new.kind, t1, t2);
    ping := case when new.by_coach and new.kind = 'team' then null else pping end;
  else
    return null;
  end if;

  perform net.http_post(
    url  := hook,
    body := jsonb_build_object(
      'content', case when ping is not null then '<@' || ping || '> ' else '' end || msg,
      'allowed_mentions', jsonb_build_object(
        'users', case when ping is not null then jsonb_build_array(ping) else '[]'::jsonb end))
  );
  return null;
exception when others then
  return null;  -- a failed ping never blocks a booking
end $$;

drop trigger if exists requests_notify on public.requests;
create trigger requests_notify after insert or update on public.requests
  for each row execute function public.notify_discord();

-- ---------------------------------------------------------------------
-- Starting data: 8 mentor slots, 4 assistant slots, the first team.
-- Empty fields show as [placeholders] on the site until filled in.
-- ---------------------------------------------------------------------

insert into public.coaches (id, kind, slot, badge_id, name, team_name, display_skin) values
  ('m1', 'mentor', 1, 'INS-0471-RX', 'Neotep', 'NeoChair', 'Training Director Katja'),
  ('m2', 'mentor', 2, 'INS-0472-KV', '', '', 'Instructor Fiora'),
  ('m3', 'mentor', 3, 'INS-0473-BL', '', '', 'Researcher Barbara'),
  ('m4', 'mentor', 4, 'INS-0474-EP', '', '', 'Student Council President Elena'),
  ('m5', 'mentor', 5, 'INS-0475-LA', '', '', 'Academy Laura'),
  ('m6', 'mentor', 6, 'INS-0476-TH', '', '', 'Academy Theodore'),
  ('m7', 'mentor', 7, 'INS-0477-ES', '', '', 'Academy Estelle'),
  ('m8', 'mentor', 8, 'INS-0478-BT', '', '', 'Transfer Student Bianca'),
  ('a1', 'assistant', 1, 'AST-0511-RC', '', '', ''),
  ('a2', 'assistant', 2, 'AST-0512-RC', '', '', ''),
  ('a3', 'assistant', 3, 'AST-0513-RC', '', '', ''),
  ('a4', 'assistant', 4, 'AST-0514-RC', '', '', ''),
  ('a5', 'assistant', 5, 'AST-0515-RC', '', '', ''),
  ('a6', 'assistant', 6, 'AST-0516-RC', '', '', ''),
  ('a7', 'assistant', 7, 'AST-0517-RC', '', '', ''),
  ('a8', 'assistant', 8, 'AST-0518-RC', '', '', ''),
  ('a9', 'assistant', 9, 'AST-0519-RC', '', '', '')
on conflict (id) do nothing;

insert into public.teams (name, coach_id, players, sort)
select 'NeoChair', 'm1',
       '[{"ign":"Irem-chan"},{"ign":"Jeiss"},{"ign":"Lumi-chan"},{"ign":"Fwitchu"}]'::jsonb, 1
where not exists (select 1 from public.teams where name = 'NeoChair');
