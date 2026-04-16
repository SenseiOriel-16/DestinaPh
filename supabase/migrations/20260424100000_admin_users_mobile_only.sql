-- Admin users page: show MOBILE APP USERS only (consumers) + keep presence fields.
-- IMPORTANT: This migration is intentionally later than prior admin_list_users() migrations.

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
    where p.role = 'consumer'
    order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

notify pgrst, 'reload schema';

