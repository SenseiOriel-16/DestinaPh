-- Seasonal / holiday promos offered by business owners (shown to tourists in the mobile app).

alter table public.businesses
  add column if not exists promo_headline text,
  add column if not exists promo_body text,
  add column if not exists promo_valid_until date;

comment on column public.businesses.promo_headline is
  'Short promo title for travelers (e.g. Summer weekend rates). Shown when non-empty and still valid.';
comment on column public.businesses.promo_body is
  'Promo details or terms for travelers.';
comment on column public.businesses.promo_valid_until is
  'Last day the promo is shown (inclusive). Null means no end date.';
