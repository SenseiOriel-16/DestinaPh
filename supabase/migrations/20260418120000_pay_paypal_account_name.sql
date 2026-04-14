-- Optional display name for PayPal (matches GCash/Maya account name on e-wallet UI).
alter table public.businesses
  add column if not exists pay_paypal_account_name text;
