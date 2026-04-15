-- Admin-only directory: profiles + auth email for support / oversight.

create or replace function public.admin_list_users()
returns table (
  id uuid,
  full_name text,
  username text,
  email text,
  role text,
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
      p.created_at
    from public.profiles p
    inner join auth.users au on au.id = p.id
    order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

notify pgrst, 'reload schema';
