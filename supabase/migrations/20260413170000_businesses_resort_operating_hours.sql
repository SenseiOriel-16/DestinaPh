-- Resort listings: operating day/night flags and separate entrance fees.

alter table public.businesses
  add column if not exists operating_day boolean not null default false,
  add column if not exists operating_night boolean not null default false,
  add column if not exists entrance_fee_day_pesos integer,
  add column if not exists entrance_fee_night_pesos integer;

comment on column public.businesses.operating_day is 'Resort: open during daytime hours';
comment on column public.businesses.operating_night is 'Resort: open during night hours';
comment on column public.businesses.entrance_fee_day_pesos is 'Resort entrance fee when operating_day is true';
comment on column public.businesses.entrance_fee_night_pesos is 'Resort entrance fee when operating_night is true';
