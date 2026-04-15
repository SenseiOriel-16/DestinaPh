import { corsPreflight, getOtpPepper, getServiceClient, isValidEmail, json, normalizeEmail, sha256Hex } from "../_shared/passwordReset.ts";

type Body = { email?: string; reset_token?: string; new_password?: string };

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
  const resetToken = String(body.reset_token ?? "").trim();
  const newPassword = String(body.new_password ?? "");

  if (!isValidEmail(email) || resetToken.length < 20) return json({ error: "Invalid request" }, 400);
  if (newPassword.length < 6) return json({ error: "Password must be at least 6 characters." }, 400);

  const supabase = await getServiceClient();
  const pepper = getOtpPepper();
  const tokenHash = await sha256Hex(`${email}:${resetToken}:${pepper}`);

  const { data: row } = await supabase
    .from("password_reset_otps")
    .select("id, reset_token_expires_at, verified_at")
    .eq("email", email)
    .eq("reset_token_hash", tokenHash)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row?.id || !row.verified_at || !row.reset_token_expires_at) {
    return json({ error: "Reset link expired. Please request a new OTP." }, 400);
  }

  const exp = new Date(row.reset_token_expires_at).getTime();
  if (Number.isNaN(exp) || Date.now() > exp) {
    return json({ error: "Reset link expired. Please request a new OTP." }, 400);
  }

  // Update Supabase Auth password via admin API
  const { data: userRes, error: getErr } = await supabase.auth.admin.getUserByEmail(email);
  if (getErr || !userRes?.user?.id) {
    // Generic response; still clear token rows to avoid reuse
    await supabase.from("password_reset_otps").delete().eq("email", email);
    return json({ ok: true });
  }

  const uid = userRes.user.id;
  const { error: updErr } = await supabase.auth.admin.updateUserById(uid, { password: newPassword });
  if (updErr) {
    console.error("[password-reset-confirm] updateUserById failed:", updErr.message);
    return json({ error: "Unable to reset password." }, 500);
  }

  await supabase.from("password_reset_otps").delete().eq("email", email);
  return json({ ok: true });
});

