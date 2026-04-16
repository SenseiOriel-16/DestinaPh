-- Admin users page improvements:
-- - Track last_seen_at for online/active indicator
-- - Exclude consumers ("clients") from admin_list_users directory
-- - Add admin_delete_user RPC for non-admin accounts

alter table public.profiles
add column if not exists last_seen_at timestamptz;

-- Postgres can't change OUT params via CREATE OR REPLACE; drop first for safety.
drop function if exists public.admin_list_users();

create or replace function public.admin_list_users()
returns table (
  id uuid,
  full_name text,
  username text,
  email text,
  role text,
  is_suspended boolean,
  last_seen_at timestamptz,
  is_online boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
    select
      p.id,
      p.full_name,
      p.username,
      au.email::text,
      p.role,
      p.is_suspended,
      p.last_seen_at,
      (p.last_seen_at is not null and p.last_seen_at >= (now() - interval '5 minutes')) as is_online,
      p.created_at
    from public.profiles p
    inner join auth.users au on au.id = p.id
    where p.role <> 'consumer'
    order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_role text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'cannot delete self';
  end if;

  select p.role into target_role
  from public.profiles p
  where p.id = p_user_id;

  if target_role is null then
    raise exception 'user not found';
  end if;

  if target_role = 'admin' then
    raise exception 'cannot delete admin accounts';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

notify pgrst, 'reload schema';

