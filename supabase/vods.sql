-- =====================================================================
-- Path to Glory · [PTG] stream VODs (step 1 of the VOD plan)
-- Coaches stream sessions on Twitch with "[PTG]" in the title. Lumi-chan
-- (separate bot) finds those streams and saves them here; the site shows
-- them as session reports.
--   coaches.twitch   the coach's Twitch name, typed in by staff
--   ptg_vods         one row per [PTG] stream (becomes one VOD)
--   ptg_marks        each stretch the title had [PTG] in it, inside that stream
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run again. Needs supabase/schema.sql to have been run first.
-- =====================================================================

-- the coach's Twitch name (just the name, e.g. "fwitchu"), set by staff in Staff desk → Coaches
alter table public.coaches add column if not exists twitch text not null default ''
  check (char_length(twitch) <= 40);

-- one [PTG] stream. Lumi-chan creates it when it first sees [PTG] in a coach's title,
-- closes it when the stream ends, and fills in the VOD once Twitch has one.
create table if not exists public.ptg_vods (
  id             uuid primary key default gen_random_uuid(),
  coach_id       text not null references public.coaches(id) on delete cascade,
  twitch_login   text not null check (char_length(twitch_login) <= 40),
  stream_id      text not null unique,                 -- Twitch's id for the broadcast
  title          text not null default '' check (char_length(title) <= 200),
  started_at     timestamptz not null,                 -- when the broadcast started on Twitch
  ended_at       timestamptz,                          -- blank while still live
  vod_id         text,                                 -- Twitch video id, once there is one
  thumbnail_url  text,
  expires_at     timestamptz,                          -- when Twitch deletes the VOD (blank if unknown or saved)
  saved          boolean not null default false,       -- the coach saved it as a Highlight, so it won't expire
  -- who it's for, set by the coach (pre-filled when it overlaps a booked session)
  kind           text check (kind in ('team', 'individual', 'general')),
  team_id        uuid references public.teams(id) on delete set null,
  profile_id     uuid references public.profiles(id) on delete set null,
  request_id     uuid references public.requests(id) on delete set null,
  note           text not null default '' check (char_length(note) <= 300),
  created_at     timestamptz not null default now()
);
-- the name it's filed under, saved with it so the public page can show it
-- (player profiles are only readable when logged in)
alter table public.ptg_vods add column if not exists for_name text not null default '' check (char_length(for_name) <= 60);
-- the coach's own title and description for the report (blank title = who it's for)
alter table public.ptg_vods add column if not exists custom_title text not null default '' check (char_length(custom_title) <= 80);
alter table public.ptg_vods add column if not exists description  text not null default '' check (char_length(description) <= 1000);
create index if not exists ptg_vods_coach on public.ptg_vods (coach_id, started_at desc);
create index if not exists ptg_vods_team on public.ptg_vods (team_id) where team_id is not null;
create index if not exists ptg_vods_profile on public.ptg_vods (profile_id) where profile_id is not null;

-- each stretch of a stream with [PTG] in the title. Taking [PTG] out and putting it
-- back makes a new mark, so one stream can have several.
create table if not exists public.ptg_marks (
  id         uuid primary key default gen_random_uuid(),
  vod_id     uuid not null references public.ptg_vods(id) on delete cascade,
  started_at timestamptz not null,
  ended_at   timestamptz,                               -- blank while [PTG] is still in the title
  label      text not null default '' check (char_length(label) <= 80),   -- e.g. "Draft review", set by the coach
  created_at timestamptz not null default now()
);
create index if not exists ptg_marks_vod on public.ptg_marks (vod_id, started_at);
-- Back-to-back sessions in one stream: the coach can add, move and remove timestamps by hand,
-- and file each one for a different team or player (blank = whoever the report is filed for).
alter table public.ptg_marks add column if not exists manual     boolean not null default false;   -- added by the coach, not Lumi-chan
alter table public.ptg_marks add column if not exists kind       text check (kind in ('team', 'individual', 'general'));
alter table public.ptg_marks add column if not exists team_id    uuid references public.teams(id) on delete set null;
alter table public.ptg_marks add column if not exists profile_id uuid references public.profiles(id) on delete set null;
alter table public.ptg_marks add column if not exists for_name   text not null default '' check (char_length(for_name) <= 60);

-- Everyone can see VODs (they're public streams). Lumi-chan writes with the database's own
-- connection, which skips these rules. On the site: staff can change anything, and a coach
-- can change their own VODs (who it's for, notes, labels, saved).
alter table public.ptg_vods enable row level security;
alter table public.ptg_marks enable row level security;
grant select on public.ptg_vods, public.ptg_marks to anon, authenticated;
grant update on public.ptg_vods, public.ptg_marks to authenticated;
grant insert, delete on public.ptg_vods, public.ptg_marks to authenticated;

create or replace function public.owns_vod(v uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() or exists (
    select 1 from public.ptg_vods pv join public.coaches c on c.id = pv.coach_id
    where pv.id = v and c.profile_id = auth.uid());
$$;

drop policy if exists "vods read" on public.ptg_vods;
create policy "vods read" on public.ptg_vods for select to anon, authenticated using (true);
drop policy if exists "vods update" on public.ptg_vods;
create policy "vods update" on public.ptg_vods for update to authenticated
  using (public.owns_vod(id)) with check (public.owns_vod(id));
drop policy if exists "vods staff insert" on public.ptg_vods;
create policy "vods staff insert" on public.ptg_vods for insert to authenticated with check (public.is_staff());
drop policy if exists "vods staff delete" on public.ptg_vods;
create policy "vods staff delete" on public.ptg_vods for delete to authenticated using (public.is_staff());

drop policy if exists "marks read" on public.ptg_marks;
create policy "marks read" on public.ptg_marks for select to anon, authenticated using (true);
drop policy if exists "marks update" on public.ptg_marks;
create policy "marks update" on public.ptg_marks for update to authenticated
  using (public.owns_vod(vod_id)) with check (public.owns_vod(vod_id));
-- a coach adds and removes timestamps on their own VODs (staff on any)
drop policy if exists "marks staff insert" on public.ptg_marks;
drop policy if exists "marks insert" on public.ptg_marks;
create policy "marks insert" on public.ptg_marks for insert to authenticated with check (public.owns_vod(vod_id));
drop policy if exists "marks staff delete" on public.ptg_marks;
drop policy if exists "marks delete" on public.ptg_marks;
create policy "marks delete" on public.ptg_marks for delete to authenticated using (public.owns_vod(vod_id));

notify pgrst, 'reload schema';

-- check: expect six rows (coaches.twitch, ptg_vods.for_name, ptg_vods.description, ptg_marks.manual, ptg_vods, ptg_marks)
select 'coaches.twitch' as part from information_schema.columns
  where table_schema = 'public' and table_name = 'coaches' and column_name = 'twitch'
union all
select 'ptg_vods.for_name' from information_schema.columns
  where table_schema = 'public' and table_name = 'ptg_vods' and column_name = 'for_name'
union all
select 'ptg_vods.description' from information_schema.columns
  where table_schema = 'public' and table_name = 'ptg_vods' and column_name = 'description'
union all
select 'ptg_marks.manual' from information_schema.columns
  where table_schema = 'public' and table_name = 'ptg_marks' and column_name = 'manual'
union all
select table_name from information_schema.tables
  where table_schema = 'public' and table_name in ('ptg_vods', 'ptg_marks');
