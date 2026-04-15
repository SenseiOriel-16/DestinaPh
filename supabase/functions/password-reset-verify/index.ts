import { corsPreflight, getOtpPepper, getServiceClient, isValidEmail, json, normalizeEmail, randomResetToken, sha256Hex } from "../_shared/passwordReset.ts";

type Body = { email?: string; otp?: string };

const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;

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
  const otp = String(body.otp ?? "").trim();
  if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
    return json({ error: "Invalid OTP" }, 400);
  }

  const supabase = await getServiceClient();

  const { data: row, error } = await supabase
    .from("password_reset_otps")
    .select("id, otp_hash, otp_expires_at, verified_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !row) {
    return json({ error: "Invalid OTP" }, 400);
  }

  if (row.verified_at) {
    return json({ error: "OTP already used" }, 400);
  }

  const exp = new Date(row.otp_expires_at).getTime();
  if (Number.isNaN(exp) || Date.now() > exp) {
    return json({ error: "OTP expired" }, 400);
  }

  const pepper = getOtpPepper();
  const candidate = await sha256Hex(`${email}:${otp}:${pepper}`);
  if (candidate !== row.otp_hash) {
    return json({ error: "Invalid OTP" }, 400);
  }

  const resetToken = randomResetToken();
  const tokenHash = await sha256Hex(`${email}:${resetToken}:${pepper}`);
  const now = Date.now();

  const { error: updErr } = await supabase
    .from("password_reset_otps")
    .update({
      verified_at: new Date(now).toISOString(),
      reset_token_hash: tokenHash,
      reset_token_expires_at: new Date(now + RESET_TOKEN_TTL_MS).toISOString(),
    })
    .eq("id", row.id);

  if (updErr) {
    console.error("[password-reset-verify] update failed:", updErr.message);
    return json({ error: "Unable to verify OTP" }, 500);
  }

  return json({ ok: true, reset_token: resetToken, reset_token_expires_in_seconds: 600 });
});

