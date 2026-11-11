-- Path to Glory: "student too" — lets a mentor, assistant or staff member also be a student (player)
-- without being on a team. They get the Student view and can request individual sessions.
-- Paste this whole file into Supabase > SQL Editor > + New > Run (with nothing highlighted). It is safe to run again.
-- Run it BEFORE pushing the site code that uses it to the live site.

-- 1. The setting itself, on each account (staff tick it in Staff > People on the site).
alter table public.profiles add column if not exists is_student boolean not null default false;

-- 2. The same setting on the access list, for people who haven't logged in yet.
alter table public.access_list add column if not exists is_student boolean not null default false;

-- 3. The access list now hands out "student too" as well.
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
revoke execute on function public.apply_access(uuid, text) from public, anon, authenticated;

-- 4. Session requests: a coach or staff member who is "student too" may request, like someone on a team.
--    (Only the one rule changes; the rest of the request checks stay as they are in schema.sql.)
do $$
declare
  src text;
begin
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'requests_before_insert';
  if src is null then
    raise exception 'Could not find public.requests_before_insert. Tell Claude, the request check function has a different name.';
  end if;
  if position('is_student' in src) = 0 then
    src := replace(src,
      'and not exists (select 1 from public.teams t where new.requester_id = any (t.member_ids)) then',
      'and not exists (select 1 from public.teams t where new.requester_id = any (t.member_ids))' || chr(10) ||
      '     and not exists (select 1 from public.profiles p where p.id = new.requester_id and p.is_student) then');
    if position('is_student' in src) = 0 then
      raise exception 'The request check did not match. Nothing was changed. Tell Claude.';
    end if;
    execute src;
  end if;
end $$;

notify pgrst, 'reload schema';

-- 5. Proof it worked: both columns exist and the request check knows about students.
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'profiles'    and column_name = 'is_student') = 1 as profiles_ready,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'access_list' and column_name = 'is_student') = 1 as access_list_ready,
  (select position('is_student' in pg_get_functiondef(p.oid)) > 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'requests_before_insert') as requests_ready;
