-- Add a simple "closed now" flag to show temporary closures.
-- Editable from client-web listing editor and displayed in mobile detail hero.

alter table public.businesses
  add column if not exists closed_now boolean not null default false;

