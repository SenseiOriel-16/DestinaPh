-- Admin decline: remove pending business-owner signup entirely (auth user + profile + cascaded rows).

create or replace function public.admin_delete_pending_owner_registration(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.role = 'business_owner'
      and p.owner_approval_status = 'pending'
  ) then
    raise exception 'not a pending business owner registration';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

comment on function public.admin_delete_pending_owner_registration(uuid) is
  'Super-admin only: deletes auth user for a pending business_owner signup (profiles + related data cascade).';

revoke all on function public.admin_delete_pending_owner_registration(uuid) from public;
grant execute on function public.admin_delete_pending_owner_registration(uuid) to authenticated;
