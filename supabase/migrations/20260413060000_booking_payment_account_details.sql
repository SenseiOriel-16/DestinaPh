-- Add richer e-wallet payout details for business owners.
-- Supports: account name + account number + QR image (already stored in booking-qrcodes).

alter table public.businesses
  add column if not exists pay_gcash_account_name text,
  add column if not exists pay_gcash_account_number text,
  add column if not exists pay_maya_account_name text,
  add column if not exists pay_maya_account_number text;

-- Keep old *_account_label columns for backwards compatibility.
-- Apps should prefer *_account_name + *_account_number, with fallback to *_account_label.

notify pgrst, 'reload schema';

