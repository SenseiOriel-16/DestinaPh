-- Password reset via email OTP (6 digits).
-- Rules:
-- - OTP expires after 5 minutes
-- - Resend is rate-limited: 60 seconds between sends per email
-- - OTPs are stored hashed; client never reads these rows (no RLS policies)

create table if not exists public.password_reset_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  otp_hash text not null,
  otp_expires_at timestamptz not null,
  resend_available_at timestamptz not null,
  verified_at timestamptz,
  reset_token_hash text,
  reset_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists password_reset_otps_email_created_at_idx
  on public.password_reset_otps (lower(email), created_at desc);

alter table public.password_reset_otps enable row level security;

-- No policies: only service role (Edge Functions) may access.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_password_reset_otps_touch on public.password_reset_otps;
create trigger trg_password_reset_otps_touch
before update on public.password_reset_otps
for each row execute function public.touch_updated_at();

notify pgrst, 'reload schema';

