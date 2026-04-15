## DestinaPH

### Forgot Password (Email OTP)

This repo includes a **custom Forgot Password** flow for:
- `apps/admin-web`
- `apps/client-web`
- `apps/mobile`

Flow:
- Enter email → send **6-digit OTP**
- OTP expires in **5 minutes**
- Resend is available after **60 seconds** (UI shows countdown)
- Verify OTP → set new password + confirm password

### Supabase migrations

Run migrations (local CLI or in your Supabase project):
- `supabase/migrations/20260425120000_password_reset_otp.sql`

### Supabase Edge Functions

Functions added under `supabase/functions/`:
- `password-reset-request`
- `password-reset-verify`
- `password-reset-confirm`

### Required secrets / env vars (DO NOT COMMIT)

Set these in **Supabase Function Secrets** (and/or your deployment environment as needed):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (required to update Auth password)
- `PASSWORD_RESET_OTP_PEPPER` (random secret string used to hash OTP/token)

SMTP (for sending OTP emails):
- `SMTP_HOST` (example: `smtp.gmail.com`)
- `SMTP_PORT` (example: `465`)
- `SMTP_USER` (SMTP username/email)
- `SMTP_PASS` (SMTP password/app password)
- `SMTP_FROM` (example: `DestinaPH <no-reply@yourdomain.com>` or your SMTP user)

### Security note (important)

If you ever shared an email/app-password in chat or in code, **rotate it immediately**:
- Generate a new app password
- Update secrets in Supabase / deployment
- Treat the old secret as compromised

