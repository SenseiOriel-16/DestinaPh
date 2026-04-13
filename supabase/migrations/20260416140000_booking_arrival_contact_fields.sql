-- Booking request details: traveler contact + arrival time for scheduling.

alter table public.bookings
  add column if not exists traveler_full_name text,
  add column if not exists traveler_contact_number text,
  add column if not exists arrival_time text;

alter table public.bookings drop constraint if exists bookings_arrival_time_check;
alter table public.bookings
  add constraint bookings_arrival_time_check
  check (
    arrival_time is null
    or arrival_time ~ '^([01]\\d|2[0-3]):[0-5]\\d$'
  );

notify pgrst, 'reload schema';

