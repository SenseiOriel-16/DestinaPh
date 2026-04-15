import { corsPreflight, getOtpPepper, getServiceClient, isValidEmail, json, normalizeEmail, randomOtp6, sendOtpEmail, sha256Hex } from "../_shared/passwordReset.ts";

type Body = { email?: string };

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
  if (!isValidEmail(email)) {
    // Generic response to avoid enumeration
    return json({ ok: true });
  }

  const supabase = await getServiceClient();

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

  // Send email. Still return ok even on email failure to avoid enumeration.
  try {
    await sendOtpEmail(email, otp);
  } catch (e) {
    console.error("[password-reset-request] email failed:", e);
  }

  return json({ ok: true, retry_after_seconds: 60 });
});

