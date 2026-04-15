import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AuthSplitLayout } from "../components/AuthSplitLayout";
import { supabase } from "../lib/supabaseClient";

type Step = "email" | "otp" | "reset" | "done";

function formatSeconds(s: number) {
  const n = Math.max(0, Math.floor(s));
  const mm = String(Math.floor(n / 60)).padStart(2, "0");
  const ss = String(n % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resendRemaining, setResendRemaining] = useState(0);
  const canResend = resendRemaining <= 0 && step === "otp";

  useEffect(() => {
    if (resendRemaining <= 0) return;
    const t = window.setInterval(() => setResendRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [resendRemaining]);

  const emailOk = useMemo(() => email.trim().includes("@"), [email]);
  const pwOk = useMemo(() => newPassword.length >= 6 && newPassword === confirmPassword, [newPassword, confirmPassword]);

  const requestOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("password-reset-request", {
        body: { email: email.trim().toLowerCase() },
      });
      if (fnErr) {
        setError(fnErr.message);
        return;
      }
      const retry = typeof (data as any)?.retry_after_seconds === "number" ? (data as any).retry_after_seconds : 60;
      setResendRemaining(Math.max(1, Math.min(60, retry)));
      setStep("otp");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("password-reset-verify", {
        body: { email: email.trim().toLowerCase(), otp: otp.trim() },
      });
      if (fnErr) {
        setError(fnErr.message);
        return;
      }
      const token = (data as any)?.reset_token as string | undefined;
      if (!token) {
        setError("Unable to verify OTP.");
        return;
      }
      setResetToken(token);
      setStep("reset");
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = async () => {
    if (!resetToken) return;
    if (!pwOk) {
      setError("Passwords must match and be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: fnErr } = await supabase.functions.invoke("password-reset-confirm", {
        body: { email: email.trim().toLowerCase(), reset_token: resetToken, new_password: newPassword },
      });
      if (fnErr) {
        setError(fnErr.message);
        return;
      }
      setStep("done");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step === "email") void requestOtp();
    if (step === "otp") void verifyOtp();
    if (step === "reset") void confirmReset();
  };

  return (
    <AuthSplitLayout variant="client">
      <div className="auth-card">
        <h2>Forgot password</h2>
        <p className="auth-lead">We’ll email you a 6-digit OTP to reset your password.</p>

        <form onSubmit={onSubmit}>
          {step === "email" ? (
            <div className="field">
              <label htmlFor="email">Email</label>
              <div className="input-with-icon">
                <span>✉</span>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
          ) : null}

          {step === "otp" ? (
            <>
              <div className="field">
                <label htmlFor="otp">Enter OTP</label>
                <div className="input-with-icon">
                  <span>🔢</span>
                  <input
                    id="otp"
                    inputMode="numeric"
                    pattern="\\d{6}"
                    placeholder="6 digits"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                    required
                  />
                </div>
                <div className="auth-hint">OTP expires in 5 minutes.</div>
              </div>

              <div className="auth-row" style={{ justifyContent: "space-between" }}>
                <button type="button" className="btn-text" disabled={!canResend || busy} onClick={() => void requestOtp()}>
                  {canResend ? "Resend OTP" : `Resend in ${formatSeconds(resendRemaining)}`}
                </button>
                <button type="button" className="btn-text" onClick={() => setStep("email")} disabled={busy}>
                  Change email
                </button>
              </div>
            </>
          ) : null}

          {step === "reset" ? (
            <>
              <div className="field">
                <label htmlFor="newpw">New password</label>
                <div className="input-with-icon">
                  <span>🔒</span>
                  <input
                    id="newpw"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="confpw">Confirm password</label>
                <div className="input-with-icon">
                  <span>🔒</span>
                  <input
                    id="confpw"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </>
          ) : null}

          {step === "done" ? (
            <div className="alert-banner alert-banner--success" style={{ marginTop: 12 }}>
              Password updated. You can sign in now.
            </div>
          ) : null}

          {error ? <div className="auth-error" style={{ marginTop: 10 }}>{error}</div> : null}

          {step !== "done" ? (
            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy || (step === "email" && !emailOk) || (step === "otp" && otp.length !== 6) || (step === "reset" && !pwOk)}
              style={{ marginTop: 12 }}
            >
              {step === "email" ? (busy ? "Sending…" : "Send OTP") : null}
              {step === "otp" ? (busy ? "Verifying…" : "Verify OTP") : null}
              {step === "reset" ? (busy ? "Updating…" : "Update password") : null}
            </button>
          ) : null}
        </form>

        <p className="auth-footer">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}

