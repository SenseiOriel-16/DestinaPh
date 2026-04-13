-- Premium upgrade payment requests (owner submits proof → admin reviews → enables premium).

create table if not exists public.premium_upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  payment_method text not null
    check (payment_method in ('ewallet', 'gcash', 'maya', 'paypal')),
  reference_number text not null,
  proof_storage_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists premium_upgrade_requests_business_idx
  on public.premium_upgrade_requests (business_id);

create index if not exists premium_upgrade_requests_status_idx
  on public.premium_upgrade_requests (status);

create unique index if not exists premium_upgrade_one_pending_per_business
  on public.premium_upgrade_requests (business_id)
  where (status = 'pending');

-- Force submitter = caller and status = pending on insert
create or replace function public.premium_upgrade_requests_before_ins()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.submitted_by := auth.uid();
  new.status := 'pending';
  new.reviewed_at := null;
  new.reviewed_by := null;
  new.admin_notes := null;
  return new;
end;
$$;

drop trigger if exists premium_upgrade_requests_before_ins on public.premium_upgrade_requests;
create trigger premium_upgrade_requests_before_ins
  before insert on public.premium_upgrade_requests
  for each row
  execute procedure public.premium_upgrade_requests_before_ins();

-- Only admins may change premium flag on businesses (owners use payment request flow)
create or replace function public.businesses_premium_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.is_premium is distinct from old.is_premium then
    if not public.is_admin() then
      raise exception 'Premium status can only be changed by an administrator (after payment approval)';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists businesses_premium_guard on public.businesses;
create trigger businesses_premium_guard
  before update on public.businesses
  for each row
  execute procedure public.businesses_premium_guard();

alter table public.premium_upgrade_requests enable row level security;

drop policy if exists "premium upgrade requests select owner admin" on public.premium_upgrade_requests;
create policy "premium upgrade requests select owner admin"
  on public.premium_upgrade_requests for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "premium upgrade requests insert owner" on public.premium_upgrade_requests;
create policy "premium upgrade requests insert owner"
  on public.premium_upgrade_requests for insert
  with check (
    auth.uid() is not null
    and exists (
      select 1 from public.businesses b
      where b.id = business_id
        and b.owner_id = auth.uid()
        and b.is_premium = false
    )
    and proof_storage_path like (auth.uid()::text || '/%')
  );

drop policy if exists "premium upgrade requests update admin" on public.premium_upgrade_requests;
create policy "premium upgrade requests update admin"
  on public.premium_upgrade_requests for update
  using (public.is_admin())
  with check (public.is_admin());

-- Private bucket for payment screenshots
insert into storage.buckets (id, name, public)
values ('premium-payment-proofs', 'premium-payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists "premium proofs select admin owner" on storage.objects;
create policy "premium proofs select admin owner"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'premium-payment-proofs'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

drop policy if exists "premium proofs insert owner" on storage.objects;
create policy "premium proofs insert owner"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'premium-payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "premium proofs update owner" on storage.objects;
create policy "premium proofs update owner"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'premium-payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "premium proofs delete owner" on storage.objects;
create policy "premium proofs delete owner"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'premium-payment-proofs'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- Bookings only for premium (approved) listings
drop policy if exists "bookings insert consumer" on public.bookings;
create policy "bookings insert consumer"
  on public.bookings for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'consumer'
    )
    and exists (
      select 1 from public.businesses b
      where b.id = business_id
        and b.status = 'approved'
        and b.is_premium = true
    )
  );
