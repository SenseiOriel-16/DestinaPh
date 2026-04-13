-- Allow both 24h HH:MM and 12h with AM/PM (e.g. 12pm, 12am, 5pm, 5:30 pm).
-- We still normalize to HH:MM in the mobile app, but this prevents inserts failing
-- if an older client sends 12-hour values.

alter table public.bookings drop constraint if exists bookings_arrival_time_check;
alter table public.bookings
  add constraint bookings_arrival_time_check
  check (
    arrival_time is null
    or arrival_time ~ '^([01]\\d|2[0-3]):[0-5]\\d$'
    or arrival_time ~* '^(0?[1-9]|1[0-2])(:[0-5]\\d)?\\s*(am|pm)$'
  );

notify pgrst, 'reload schema';

