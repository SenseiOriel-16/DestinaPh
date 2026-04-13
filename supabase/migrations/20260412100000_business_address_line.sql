-- Optional street / zone line for listing forms (client mock)
alter table public.businesses
  add column if not exists address_line text;
