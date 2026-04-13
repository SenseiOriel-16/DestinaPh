-- Expose auth email to dashboard admins only (for Manage Clients contact details).

create or replace function public.admin_profile_email(p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return (
    select au.email::text
    from auth.users au
    where au.id = p_profile_id
    limit 1
  );
end;
$$;

revoke all on function public.admin_profile_email(uuid) from public;
grant execute on function public.admin_profile_email(uuid) to authenticated;

-- Refresh PostgREST so /rest/v1/rpc/admin_profile_email is available immediately.
notify pgrst, 'reload schema';
