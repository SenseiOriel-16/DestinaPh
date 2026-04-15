import { corsPreflight, getOtpPepper, getServiceClient, isValidEmail, json, normalizeEmail, sha256Hex } from "../_shared/passwordReset.ts";

type Body = { email?: string; reset_token?: string; new_password?: string };

async function getUserIdByEmailViaAdminApi(email: string): Promise<string | null> {
  const url = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
  if (!url) throw new Error("Missing env var: SUPABASE_URL (or VITE_SUPABASE_URL)");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) throw new Error("Missing env var: SUPABASE_SERVICE_ROLE_KEY");

  const res = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`admin users lookup failed: ${res.status} ${t}`);
  }
  const data = (await res.json()) as { users?: Array<{ id: string; email?: string }> };
  const u = data.users?.[0];
  return u?.id ?? null;
}

async function updatePasswordViaAdminApi(userId: string, newPassword: string): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
  if (!url) throw new Error("Missing env var: SUPABASE_URL (or VITE_SUPABASE_URL)");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) throw new Error("Missing env var: SUPABASE_SERVICE_ROLE_KEY");

  const res = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ password: newPassword }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`admin update user failed: ${res.status} ${t}`);
  }
}

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

  // Update Supabase Auth password via Admin REST API (works even if supabase-js admin methods are unavailable)
  try {
    const uid = await getUserIdByEmailViaAdminApi(email);
    if (!uid) {
      await supabase.from("password_reset_otps").delete().eq("email", email);
      return json({ ok: true });
    }
    await updatePasswordViaAdminApi(uid, newPassword);
  } catch (e) {
    console.error("[password-reset-confirm] admin api failed:", e);
    return json({ error: "Unable to reset password." }, 500);
  }

  await supabase.from("password_reset_otps").delete().eq("email", email);
  return json({ ok: true });
});

