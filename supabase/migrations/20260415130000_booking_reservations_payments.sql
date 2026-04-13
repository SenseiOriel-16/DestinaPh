-- Premium booking flow: owner payment methods (GCash / Maya / PayPal), reservation details,
-- 50% downpayment snapshot, payment proof + reference, owner confirm/cancel.

-- —— Business payment settings (only used when is_premium) ——
alter table public.businesses
  add column if not exists pay_gcash_enabled boolean not null default false,
  add column if not exists pay_gcash_qr_path text,
  add column if not exists pay_gcash_account_label text,
  add column if not exists pay_maya_enabled boolean not null default false,
  add column if not exists pay_maya_qr_path text,
  add column if not exists pay_maya_account_label text,
  add column if not exists pay_paypal_enabled boolean not null default false,
  add column if not exists pay_paypal_email text;

-- —— Bookings: reservation + payment ——
alter table public.bookings
  add column if not exists accommodation_name text,
  add column if not exists check_in date,
  add column if not exists check_out date,
  add column if not exists guest_count integer,
  add column if not exists estimated_total_pesos integer,
  add column if not exists downpayment_percent integer not null default 50,
  add column if not exists downpayment_pesos integer,
  add column if not exists payment_method text,
  add column if not exists payment_reference text,
  add column if not exists payment_proof_storage_path text,
  add column if not exists owner_note text;

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check
  check (status in ('requested', 'pending_review', 'confirmed', 'cancelled'));

alter table public.bookings drop constraint if exists bookings_payment_method_check;
alter table public.bookings
  add constraint bookings_payment_method_check
  check (payment_method is null or payment_method in ('gcash', 'maya', 'paypal'));

-- —— Storage: QR codes (public read), payment proofs (private) ——
insert into storage.buckets (id, name, public)
values ('booking-qrcodes', 'booking-qrcodes', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('booking-payment-proofs', 'booking-payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists "booking qrcodes public read" on storage.objects;
create policy "booking qrcodes public read"
  on storage.objects for select
  using (bucket_id = 'booking-qrcodes');

drop policy if exists "booking qrcodes owner write" on storage.objects;
create policy "booking qrcodes owner write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'booking-qrcodes'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
    )
  );

drop policy if exists "booking qrcodes owner update" on storage.objects;
create policy "booking qrcodes owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'booking-qrcodes'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
    )
  );

drop policy if exists "booking qrcodes owner delete" on storage.objects;
create policy "booking qrcodes owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'booking-qrcodes'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
    )
  );

drop policy if exists "booking proofs insert traveler" on storage.objects;
create policy "booking proofs insert traveler"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'booking-payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "booking proofs select parties" on storage.objects;
create policy "booking proofs select parties"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'booking-payment-proofs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.bookings bk
        join public.businesses b on b.id = bk.business_id
        where bk.id::text = (storage.foldername(name))[2]
          and b.owner_id = auth.uid()
      )
      or public.is_admin()
    )
  );

drop policy if exists "booking proofs delete traveler" on storage.objects;
create policy "booking proofs delete traveler"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'booking-payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- —— Bookings RLS: new rows use pending_review when payment proof flow ——
drop policy if exists "bookings update parties" on public.bookings;
create policy "bookings update parties"
  on public.bookings for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
    or public.is_admin()
  );

-- Consumer inserts: premium listings only; status must be initial request states.
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
    and status in ('pending_review', 'requested')
  );

notify pgrst, 'reload schema';
