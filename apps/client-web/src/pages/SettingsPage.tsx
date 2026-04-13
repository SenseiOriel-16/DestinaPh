import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function SettingsPage() {
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      setAccountEmail(data.user?.email ?? null);
    })();
  }, []);

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const mail = accountEmail?.trim();
    if (!mail) {
      setMessage("No email on this session. Sign in again.");
      return;
    }
    if (newPassword.length < 6) {
      setMessage("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("New password and confirmation do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: mail,
        password: currentPassword,
      });
      if (verifyErr) {
        setMessage(verifyErr.message.includes("Invalid") ? "Current password is incorrect." : verifyErr.message);
        return;
      }
      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) {
        setMessage(updErr.message);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated successfully.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-stack">
      <div>
        <h1 className="dash-title" style={{ marginBottom: 8 }}>
          Account settings
        </h1>
        <p className="dash-sub" style={{ marginBottom: 0 }}>
          Update your sign-in password. Contact support and display options are in the sidebar under Settings.
        </p>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <span className="card__title">Change password</span>
        <span className="card__subtitle">
          {accountEmail ? `Signed in as ${accountEmail}` : "Loading account…"}
        </span>
        <form className="owner-settings-form" onSubmit={(ev) => void onChangePassword(ev)}>
          <label className="owner-settings-form__label" htmlFor="cur-pw">
            Current password
          </label>
          <input
            id="cur-pw"
            className="owner-settings-form__input"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(ev) => setCurrentPassword(ev.target.value)}
          />
          <label className="owner-settings-form__label" htmlFor="new-pw">
            New password
          </label>
          <input
            id="new-pw"
            className="owner-settings-form__input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(ev) => setNewPassword(ev.target.value)}
          />
          <label className="owner-settings-form__label" htmlFor="conf-pw">
            Confirm new password
          </label>
          <input
            id="conf-pw"
            className="owner-settings-form__input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(ev) => setConfirmPassword(ev.target.value)}
          />
          {message ? (
            <p
              className={`owner-settings-form__msg ${message.includes("success") ? "owner-settings-form__msg--ok" : ""}`}
            >
              {message}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }} disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
