-- Explicit reason shown to travelers when the business is marked closed_now.

alter table public.businesses
  add column if not exists closed_reason text;

comment on column public.businesses.closed_reason is
  'Short explanation for travelers when closed_now is true (e.g. renovation, holiday). Shown in the mobile closed notice; optional.';
