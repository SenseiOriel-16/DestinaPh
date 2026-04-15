function requiredEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
  if (!url) throw new Error("Missing env var: SUPABASE_URL (or VITE_SUPABASE_URL)");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  // Lazy import to keep module load cheap in edge runtime
  return import("npm:@supabase/supabase-js").then(({ createClient }) =>
    createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  );
}

export function normalizeEmail(raw: string): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.includes("@") && email.length <= 254;
}

export function randomOtp6(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return toHex(digest);
}

export function base64Url(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function randomResetToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders,
    },
  });
}

export const corsHeaders: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

export function corsPreflight(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  return null;
}

export function getOtpPepper(): string {
  return requiredEnv("PASSWORD_RESET_OTP_PEPPER");
}

export async function sendOtpEmail(to: string, otp: string) {
  const host = requiredEnv("SMTP_HOST");
  const port = Number(requiredEnv("SMTP_PORT"));
  const user = requiredEnv("SMTP_USER");
  const pass = requiredEnv("SMTP_PASS");
  const from = requiredEnv("SMTP_FROM");

  const secure = port === 465;
  const nodemailer = await import("npm:nodemailer");
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const safeOtp = String(otp ?? "").trim();
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>DestinaPH password reset</title>
  </head>
  <body style="margin:0;padding:0;background:#eef1f5;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:#1a1d21;">
    <!-- Preheader (hidden) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Your OTP code is ${safeOtp}. It expires in 5 minutes.
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef1f5;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
            <tr>
              <td style="padding:0 6px 12px;">
                <div style="font-weight:900;letter-spacing:-0.02em;font-size:18px;color:#0b1b32;">
                  DestinaPH
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #e2e6eb;border-radius:16px;box-shadow:0 12px 40px rgba(11,27,50,0.10);overflow:hidden;">
                <div style="padding:18px 18px 0;background:linear-gradient(135deg, rgba(8,143,143,0.10) 0%, rgba(11,60,93,0.06) 100%);border-bottom:1px solid rgba(226,230,235,0.9);">
                  <div style="font-size:16px;font-weight:900;color:#0b3c5d;letter-spacing:-0.02em;">
                    Password reset request
                  </div>
                  <div style="margin-top:6px;font-size:13px;line-height:1.45;color:#6b7280;font-weight:600;">
                    Use the one-time code below to reset your DestinaPH password.
                  </div>
                  <div style="height:14px;"></div>
                </div>

                <div style="padding:18px;">
                  <div style="font-size:12px;letter-spacing:0.10em;text-transform:uppercase;color:#6b7280;font-weight:800;">
                    One-time password (OTP)
                  </div>
                  <div style="margin-top:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px 14px;">
                    <div style="font-size:28px;letter-spacing:0.22em;font-weight:900;color:#0b1b32;text-align:center;">
                      ${safeOtp}
                    </div>
                  </div>
                  <div style="margin-top:12px;font-size:13px;line-height:1.55;color:#6b7280;font-weight:600;">
                    This code expires in <strong style="color:#0b1b32;">5 minutes</strong>. If you didn’t request a password reset, you can safely ignore this email.
                  </div>

                  <div style="margin-top:14px;padding:12px 12px;border-radius:12px;background:rgba(8,143,143,0.08);border:1px solid rgba(8,143,143,0.18);">
                    <div style="font-size:12.5px;line-height:1.5;color:#0b3c5d;font-weight:700;">
                      Tip: Don’t share your OTP with anyone. DestinaPH support will never ask for it.
                    </div>
                  </div>
                </div>

                <div style="padding:14px 18px 18px;border-top:1px solid rgba(226,230,235,0.9);background:#ffffff;">
                  <div style="font-size:12px;line-height:1.5;color:#94a3b8;font-weight:600;">
                    © ${new Date().getFullYear()} DestinaPH. All rights reserved.
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 6px 0;">
                <div style="font-size:11.5px;line-height:1.5;color:#94a3b8;font-weight:600;">
                  If the OTP block doesn’t render correctly, copy and paste this code: <strong style="color:#0b1b32;">${safeOtp}</strong>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  await transporter.sendMail({
    from,
    to,
    subject: "Your DestinaPH password reset code",
    text: `Your DestinaPH password reset OTP is: ${safeOtp}\n\nThis code expires in 5 minutes.\n\nIf you didn’t request this, you can ignore this email.`,
    html,
  });
}

