-- Add a "fully booked" flag to disable reservations while still showing the listing.

alter table public.businesses
  add column if not exists fully_booked boolean not null default false;

