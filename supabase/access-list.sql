-- Path to Glory: who gets what access, set up BEFORE they ever log in.
-- Paste this whole file into Supabase > SQL Editor and click Run. It is safe to run again.
-- Anyone not on this list can still log in; they just have no event access (for things like Pickems).

-- The list: one row per Discord account. Add people at the bottom of this file.
create table if not exists public.access_list (
  discord_id text primary key check (discord_id ~ '^[0-9]{15,22}$'),
  note       text not null default '',                 -- who this is, for your own reference
  is_staff   boolean not null default false,
  coach_id   text references public.coaches(id) on delete set null,   -- m1..m8 or a1..a8
  team_name  text not null default ''                  -- must match the team's name in the teams table
);
alter table public.access_list add column if not exists is_student boolean not null default false;   -- "student too" (needs student-access.sql)
alter table public.access_list enable row level security;
drop policy if exists "access list staff" on public.access_list;
create policy "access list staff" on public.access_list
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Gives one account everything the list says it should have.
create or replace function public.apply_access(uid uuid, did text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a public.access_list;
begin
  select * into a from public.access_list where discord_id = did;
  if not found then
    return;
  end if;
  if a.is_staff then
    update public.profiles set role = 'staff' where id = uid;
  end if;
  if a.is_student then
    update public.profiles set is_student = true where id = uid;
  end if;
  if a.coach_id is not null then
    update public.coaches set profile_id = uid where id = a.coach_id;
  end if;
  if a.team_name <> '' then
    update public.teams set member_ids = array_append(member_ids, uid)
      where lower(name) = lower(a.team_name) and not (uid = any(member_ids));
  end if;
end $$;

-- On someone's first login. A problem here must never stop them logging in.
create or replace function public.profile_apply_access() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.apply_access(new.id, new.discord_id);
  exception when others then
    raise warning 'access list: %', sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists profile_apply_access on public.profiles;
create trigger profile_apply_access after insert on public.profiles
  for each row execute function public.profile_apply_access();

-- When someone is added to the list after they have already logged in.
create or replace function public.list_apply_access() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
begin
  select id into uid from public.profiles where discord_id = new.discord_id;
  if uid is not null then
    perform public.apply_access(uid, new.discord_id);
  end if;
  return new;
end $$;
drop trigger if exists list_apply_access on public.access_list;
create trigger list_apply_access after insert or update on public.access_list
  for each row execute function public.list_apply_access();

-- Run "select public.reapply_access();" after adding teams, so people already listed join them.
create or replace function public.reapply_access() returns void
language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  for p in select pr.id, pr.discord_id from public.profiles pr join public.access_list a using (discord_id) loop
    perform public.apply_access(p.id, p.discord_id);
  end loop;
end $$;
revoke execute on function public.apply_access(uuid, text), public.reapply_access() from public, anon, authenticated;

-- Clear the old starter values, so the mentor info in the site's own files shows until staff edit it.
update public.coaches set name = '', team_name = '' where id = 'm1' and name = 'Neotep';
update public.coaches set display_skin = '' where id = 'm2' and display_skin = 'Instructor Fiora';
update public.coaches set display_skin = '' where id = 'm3' and display_skin = 'Researcher Barbara';

-- ---------------------------------------------------------------------
-- PEOPLE: add a line for each person, then run this part again.
-- insert into public.access_list (discord_id, note, is_staff, coach_id, team_name) values
--   ('123456789012345678', 'your name',  true,  null, ''),          -- staff
--   ('234567890123456789', 'Actor',      false, 'm1', ''),          -- mentor 1
--   ('345678901234567890', 'Squortle',   false, 'a4', ''),          -- assistant 4
--   ('456789012345678901', 'a player',   false, null, 'NeoChair')   -- player
-- on conflict (discord_id) do update set note = excluded.note, is_staff = excluded.is_staff,
--   coach_id = excluded.coach_id, team_name = excluded.team_name;
-- ---------------------------------------------------------------------
