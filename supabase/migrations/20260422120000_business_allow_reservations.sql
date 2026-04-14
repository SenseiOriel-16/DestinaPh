-- Allow business owners to toggle reservations on/off per listing.

alter table public.businesses
  add column if not exists allow_reservations boolean not null default true;

-- Enforce at the database level: consumer inserts must target listings with reservations enabled.
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
        and b.allow_reservations = true
    )
    and status in ('pending_review', 'requested')
  );

notify pgrst, 'reload schema';

