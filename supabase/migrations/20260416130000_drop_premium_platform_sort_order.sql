-- One payout account per payment type is enough; remove manual sort ordering.

drop index if exists public.premium_platform_payment_accounts_sort_idx;

alter table public.premium_platform_payment_accounts
  drop column if exists sort_order;
