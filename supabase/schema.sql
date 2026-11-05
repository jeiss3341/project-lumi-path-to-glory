-- =====================================================================
-- Path to Glory · Supabase schema
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- It is safe to run again after edits (tables use IF NOT EXISTS,
-- functions are replaced, policies are dropped and re-created).
--
-- Who can do what (enforced here, not in the browser):
--   anyone            reads coaches, teams, posted hours, busy times
--   signed-in player  sends one application, requests sessions, cancels own
--   mentor / assist.  posts own hours, accepts or declines own requests,
--                     edits own mentor file
--   staff             everything: reviews applications, builds teams,
--                     links coaches to Discord accounts, sets roles
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

-- Team and solo applications. One per Discord account.
create table if not exists public.signups (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique default auth.uid() references public.profiles(id) on delete cascade,
  kind             text not null check (kind in ('team', 'solo')),
  team_name        text check (char_length(team_name) <= 40),
  players          jsonb not null default '[]'::jsonb
                   check (jsonb_typeof(players) = 'array' and jsonb_array_length(players) <= 6),
  played_qualifier boolean,
  t2_events        text check (char_length(t2_events) <= 200),
  mentor_prefs     text[] not null default '{}' check (cardinality(mentor_prefs) <= 3),
  ign              text check (char_length(ign) <= 40),
  main_role        text check (char_length(main_role) <= 120),
  availability     text check (char_length(availability) <= 200),
  experience       text check (char_length(experience) <= 300),
  seminar_topics   text check (char_length(seminar_topics) <= 500),
  status           text not null default 'pending'
                   check (status in ('pending', 'accepted', 'waitlist', 'declined', 'withdrawn')),
  staff_note       text check (char_length(staff_note) <= 300),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (kind <> 'team' or coalesce(btrim(team_name), '') <> ''),
  check (kind <> 'solo' or coalesce(btrim(ign), '') <> '')
);

-- Teams that staff build from applications.
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) <= 40),
  coach_id   text references public.coaches(id) on delete set null,
  players    jsonb not null default '[]'::jsonb check (jsonb_typeof(players) = 'array'),
  member_ids uuid[] not null default '{}',   -- logged-in accounts on this team
  signup_id  uuid references public.signups(id) on delete set null,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

-- Hours a coach is free: one row per block (hour in → hour out).
create table if not exists public.availability (
  id         uuid primary key default gen_random_uuid(),
  coach_id   text not null references public.coaches(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '12 hours'),
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
  check (ends_at - starts_at between interval '30 minutes' and interval '2 hours'),
  constraint requests_no_double_booking
    exclude using gist (coach_id with =, tstzrange(starts_at, ends_at) with &&) where (status = 'accepted')
);

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
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    coalesce(new.raw_user_meta_data -> 'custom_claims' ->> 'global_name',
             new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'name'),
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
    username     = coalesce(new.raw_user_meta_data ->> 'name', username),
    display_name = coalesce(new.raw_user_meta_data -> 'custom_claims' ->> 'global_name', display_name),
    avatar_url   = coalesce(new.raw_user_meta_data ->> 'avatar_url', avatar_url)
  where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of raw_user_meta_data on auth.users
  for each row execute function public.handle_user_update();

-- Coaches may edit their own file, but not their slot or who they're linked to.
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

-- Players edit their own application while it's open; only staff decide it.
create or replace function public.signups_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if auth.uid() is null or public.is_staff() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.status := 'pending';
    new.staff_note := null;
    return new;
  end if;
  if new.user_id <> old.user_id then
    raise exception 'An application can''t move to another account.';
  end if;
  if new.staff_note is distinct from old.staff_note then
    raise exception 'Only staff can add notes.';
  end if;
  if old.status in ('accepted', 'declined') then
    raise exception 'Staff have already decided this application. Message staff to change it.';
  end if;
  if new.status <> old.status
     and not (new.status = 'withdrawn' and old.status in ('pending', 'waitlist'))
     and not (new.status = 'pending' and old.status = 'withdrawn') then
    raise exception 'Only staff can change an application''s status.';
  end if;
  new.created_at := old.created_at;
  return new;
end $$;

drop trigger if exists signups_guard on public.signups;
create trigger signups_guard before insert or update on public.signups
  for each row execute function public.signups_guard();

-- A coach can't delete hours that already have booked sessions in them.
create or replace function public.availability_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.requests r
    where r.coach_id = old.coach_id and r.status = 'accepted'
      and r.starts_at >= old.starts_at and r.ends_at <= old.ends_at
  ) then
    raise exception 'These hours have booked sessions. Cancel those sessions first.';
  end if;
  return old;
end $$;

drop trigger if exists availability_guard on public.availability;
create trigger availability_guard before delete on public.availability
  for each row execute function public.availability_guard();

-- Validate a new request: inside posted hours, not booked, not in the past.
create or replace function public.requests_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  k text;
begin
  if auth.uid() is not null then
    new.requester_id := auth.uid();
  end if;
  new.status := 'pending';
  new.decided_at := null;

  select kind into k from public.coaches where id = new.coach_id;
  if k is null then
    raise exception 'That coach doesn''t exist.';
  end if;
  if k = 'assistant' and new.kind <> 'individual' then
    raise exception 'Assistant coaches take individual sessions only.';
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

-- Only the status changes, and only in allowed ways.
create or replace function public.requests_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.coach_id <> old.coach_id or new.requester_id <> old.requester_id
     or new.starts_at <> old.starts_at or new.ends_at <> old.ends_at
     or new.kind <> old.kind or new.note <> old.note then
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
alter table public.signups      enable row level security;
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

-- coaches
drop policy if exists "coaches read" on public.coaches;
create policy "coaches read" on public.coaches
  for select to anon, authenticated using (true);
drop policy if exists "coaches update" on public.coaches;
create policy "coaches update" on public.coaches
  for update to authenticated
  using (public.is_staff() or profile_id = auth.uid())
  with check (public.is_staff() or profile_id = auth.uid());
drop policy if exists "coaches staff insert" on public.coaches;
create policy "coaches staff insert" on public.coaches
  for insert to authenticated with check (public.is_staff());
drop policy if exists "coaches staff delete" on public.coaches;
create policy "coaches staff delete" on public.coaches
  for delete to authenticated using (public.is_staff());

-- signups
drop policy if exists "signups read" on public.signups;
create policy "signups read" on public.signups
  for select to authenticated using (user_id = auth.uid() or public.is_staff());
drop policy if exists "signups insert" on public.signups;
create policy "signups insert" on public.signups
  for insert to authenticated with check (user_id = auth.uid() or public.is_staff());
drop policy if exists "signups update" on public.signups;
create policy "signups update" on public.signups
  for update to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());
drop policy if exists "signups staff delete" on public.signups;
create policy "signups staff delete" on public.signups
  for delete to authenticated using (public.is_staff());

-- teams
drop policy if exists "teams read" on public.teams;
create policy "teams read" on public.teams
  for select to anon, authenticated using (true);
drop policy if exists "teams staff write" on public.teams;
create policy "teams staff write" on public.teams
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

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
  using (requester_id = auth.uid() or public.is_coach(coach_id) or public.is_staff());
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

  if tg_op = 'INSERT' then
    msg := format('New %s session request for %s: <t:%s:F> to <t:%s:t>, from %s. Accept or decline it on your mentor desk.',
                  new.kind, cname, t1, t2, pname);
    ping := cping;
  elsif new.status <> old.status and new.status in ('accepted', 'declined') then
    msg := format('%s %s your %s session request for <t:%s:F> to <t:%s:t>.', cname, new.status, new.kind, t1, t2);
    ping := pping;
  elsif new.status <> old.status and new.status = 'cancelled' then
    msg := format('The %s session with %s on <t:%s:F> was cancelled.', new.kind, cname, t1);
    ping := case when public.is_coach(new.coach_id) then pping else cping end;
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
  ('a8', 'assistant', 8, 'AST-0518-RC', '', '', '')
on conflict (id) do nothing;

insert into public.teams (name, coach_id, players, sort)
select 'NeoChair', 'm1',
       '[{"ign":"Rustska"},{"ign":"Jeiss"},{"ign":"Jast107"},{"ign":"Fwitchu"}]'::jsonb, 1
where not exists (select 1 from public.teams where name = 'NeoChair');
