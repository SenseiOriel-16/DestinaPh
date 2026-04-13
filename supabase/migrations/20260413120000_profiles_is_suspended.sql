-- Suspend business owners without revoking approval; block inserts/updates when suspended.

alter table public.profiles
  add column if not exists is_suspended boolean not null default false;

drop policy if exists "businesses insert owner" on public.businesses;

create policy "businesses insert owner"
  on public.businesses for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'business_owner'
        and p.owner_approval_status = 'approved'
        and coalesce(p.is_suspended, false) = false
    )
  );

drop policy if exists "businesses update privileged" on public.businesses;

create policy "businesses update privileged"
  on public.businesses for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      auth.uid() = owner_id
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and coalesce(p.is_suspended, false) = false
      )
    )
  );
