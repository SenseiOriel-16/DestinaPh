import { AccountType, corsPreflight, getOtpPepper, getProfileRoleByEmail, getServiceClient, isValidEmail, json, labelForAccountType, normalizeEmail, randomOtp6, requiredRoleForAccountType, sendOtpEmail, sha256Hex } from "../_shared/passwordReset.ts";

type Body = { email?: string; account_type?: AccountType };

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const email = normalizeEmail(body.email ?? "");
  const accountType = (body.account_type ?? "user") as AccountType;
  if (!isValidEmail(email)) {
    return json({ error: "Invalid email" }, 400);
  }

  const supabase = await getServiceClient();

  // Enforce account-type ownership (admin/client/user).
  try {
    const role = await getProfileRoleByEmail(email);
    const need = requiredRoleForAccountType(accountType);
    if (!role || role !== need) {
      return json({ error: `Email does not exist in a ${labelForAccountType(accountType)} account.` }, 400);
    }
  } catch (e) {
    console.error("[password-reset-request] role check failed:", e);
    return json({ error: "Unable to process request" }, 500);
  }

  // Rate limit per email.
  const { data: last } = await supabase
    .from("password_reset_otps")
    .select("resend_available_at")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last?.resend_available_at) {
    const retryAt = new Date(last.resend_available_at).getTime();
    const now = Date.now();
    if (!Number.isNaN(retryAt) && now < retryAt) {
      const retryAfterSeconds = Math.ceil((retryAt - now) / 1000);
      return json({ ok: true, retry_after_seconds: retryAfterSeconds });
    }
  }

  // Generate + store hashed OTP
  const otp = randomOtp6();
  const pepper = getOtpPepper();
  const otpHash = await sha256Hex(`${email}:${otp}:${pepper}`);
  const now = Date.now();

  const { error: insErr } = await supabase.from("password_reset_otps").insert({
    email,
    otp_hash: otpHash,
    otp_expires_at: new Date(now + OTP_TTL_MS).toISOString(),
    resend_available_at: new Date(now + RESEND_COOLDOWN_MS).toISOString(),
  });

  if (insErr) {
    // Avoid leaking internal details
    console.error("[password-reset-request] insert failed:", insErr.message);
    return json({ ok: true });
  }

  // Send email.
  try {
    await sendOtpEmail(email, otp);
  } catch (e) {
    console.error("[password-reset-request] email failed:", e);
  }

  return json({ ok: true, retry_after_seconds: 60 });
});

