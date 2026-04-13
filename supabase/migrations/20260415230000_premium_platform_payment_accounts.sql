-- Platform-owned e-wallet / payment details shown to business owners on the Premium upgrade page.
-- Admins manage rows + QR images; authenticated owners read active rows and can fetch QR objects.

create table if not exists public.premium_platform_payment_accounts (
  id uuid primary key default gen_random_uuid(),
  provider_type text not null
    check (provider_type in ('ewallet', 'gcash', 'maya', 'paypal')),
  display_label text not null,
  account_name text not null,
  account_number text not null,
  qr_storage_path text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists premium_platform_payment_accounts_sort_idx
  on public.premium_platform_payment_accounts (sort_order, id);

drop trigger if exists premium_platform_payment_accounts_touch on public.premium_platform_payment_accounts;
create trigger premium_platform_payment_accounts_touch
  before update on public.premium_platform_payment_accounts
  for each row execute procedure public.touch_updated_at();

alter table public.premium_platform_payment_accounts enable row level security;

drop policy if exists "premium platform accounts select" on public.premium_platform_payment_accounts;
create policy "premium platform accounts select"
  on public.premium_platform_payment_accounts for select
  to authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "premium platform accounts insert admin" on public.premium_platform_payment_accounts;
create policy "premium platform accounts insert admin"
  on public.premium_platform_payment_accounts for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "premium platform accounts update admin" on public.premium_platform_payment_accounts;
create policy "premium platform accounts update admin"
  on public.premium_platform_payment_accounts for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "premium platform accounts delete admin" on public.premium_platform_payment_accounts;
create policy "premium platform accounts delete admin"
  on public.premium_platform_payment_accounts for delete
  to authenticated
  using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('premium-platform-qr', 'premium-platform-qr', false)
on conflict (id) do nothing;

drop policy if exists "premium platform qr select authenticated" on storage.objects;
create policy "premium platform qr select authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'premium-platform-qr');

drop policy if exists "premium platform qr insert admin" on storage.objects;
create policy "premium platform qr insert admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'premium-platform-qr'
    and public.is_admin()
  );

drop policy if exists "premium platform qr update admin" on storage.objects;
create policy "premium platform qr update admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'premium-platform-qr'
    and public.is_admin()
  );

drop policy if exists "premium platform qr delete admin" on storage.objects;
create policy "premium platform qr delete admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'premium-platform-qr'
    and public.is_admin()
  );
