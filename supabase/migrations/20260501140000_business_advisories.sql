-- Add optional advisory fields for tourists (events, closures, holiday schedules).
-- Editable from client-web listing editor.

alter table public.businesses
  add column if not exists advisory_text text,
  add column if not exists operating_variations_text text;

