-- Add operating hours fields for destinations/listings.
-- Stores a simple 12-hour clock representation suitable for mobile display.

alter table public.businesses
add column if not exists operating_hours_always_open boolean not null default false,
add column if not exists operating_open_hour smallint,
add column if not exists operating_open_meridiem text,
add column if not exists operating_close_hour smallint,
add column if not exists operating_close_meridiem text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'businesses_operating_open_hour_check'
  ) then
    alter table public.businesses
      add constraint businesses_operating_open_hour_check
      check (operating_open_hour is null or (operating_open_hour >= 1 and operating_open_hour <= 12));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'businesses_operating_close_hour_check'
  ) then
    alter table public.businesses
      add constraint businesses_operating_close_hour_check
      check (operating_close_hour is null or (operating_close_hour >= 1 and operating_close_hour <= 12));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'businesses_operating_open_meridiem_check'
  ) then
    alter table public.businesses
      add constraint businesses_operating_open_meridiem_check
      check (operating_open_meridiem is null or operating_open_meridiem in ('AM', 'PM'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'businesses_operating_close_meridiem_check'
  ) then
    alter table public.businesses
      add constraint businesses_operating_close_meridiem_check
      check (operating_close_meridiem is null or operating_close_meridiem in ('AM', 'PM'));
  end if;
end $$;

notify pgrst, 'reload schema';

