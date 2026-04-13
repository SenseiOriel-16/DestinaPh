-- Store day/night trip selection + fee snapshots on bookings.

alter table public.bookings
  add column if not exists trip_period text,
  add column if not exists entrance_fee_each_pesos integer,
  add column if not exists entrance_fee_total_pesos integer,
  add column if not exists accommodation_cost_pesos integer;

alter table public.bookings drop constraint if exists bookings_trip_period_check;
alter table public.bookings
  add constraint bookings_trip_period_check
  check (trip_period is null or trip_period in ('day', 'night'));

notify pgrst, 'reload schema';

