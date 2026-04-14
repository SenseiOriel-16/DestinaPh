import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="owner-settings-form__pw-wrap">
      <input
        id={id}
        className="owner-settings-form__input owner-settings-form__input--pw"
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <button
        type="button"
        className="owner-settings-form__pw-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

export function SettingsPage() {
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [initialFullName, setInitialFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [initialBusinessName, setInitialBusinessName] = useState("");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [confirmBizOpen, setConfirmBizOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const u = auth.user;
      if (!u) {
        setAccountEmail(null);
        setUserId(null);
        return;
      }
      setAccountEmail(u.email ?? null);
      setUserId(u.id);

      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", u.id).maybeSingle();
      const fn = prof?.full_name?.trim() ?? "";
      setFullName(fn);
      setInitialFullName(fn);

      const { data: rows } = await supabase
        .from("businesses")
        .select("id,name")
        .eq("owner_id", u.id)
        .order("created_at", { ascending: true });
      const list = rows ?? [];
      const first = list[0] as { id: string; name: string } | undefined;
      if (first?.id) {
        setBusinessId(first.id);
        const bn = first.name?.trim() ?? "";
        setBusinessName(bn);
        setInitialBusinessName(bn);
      } else {
        setBusinessId(null);
        setBusinessName("");
        setInitialBusinessName("");
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const applyProfileSave = async (includeBusinessName: boolean) => {
    if (!userId) {
      setProfileMessage("Not signed in.");
      return;
    }
    const fn = fullName.trim();
    if (!fn) {
      setProfileMessage("Please enter your name.");
      return;
    }
    const bn = businessName.trim();
    if (businessId && includeBusinessName && !bn) {
      setProfileMessage("Business name cannot be empty.");
      return;
    }

    setProfileBusy(true);
    setProfileMessage(null);
    try {
      const { error: pErr } = await supabase.from("profiles").update({ full_name: fn }).eq("id", userId);
      if (pErr) {
        setProfileMessage(pErr.message);
        return;
      }
      const { error: aErr } = await supabase.auth.updateUser({ data: { full_name: fn } });
      if (aErr) {
        setProfileMessage(aErr.message);
        return;
      }
      if (includeBusinessName && businessId && bn) {
        const { error: bErr } = await supabase.from("businesses").update({ name: bn }).eq("id", businessId).eq("owner_id", userId);
        if (bErr) {
          setProfileMessage(bErr.message);
          return;
        }
        setInitialBusinessName(bn);
      }
      setInitialFullName(fn);
      window.dispatchEvent(new CustomEvent("destinaph-owner-profile-updated"));
      setProfileMessage("Profile saved successfully.");
      setConfirmBizOpen(false);
    } finally {
      setProfileBusy(false);
    }
  };

  const onSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    if (!userId) {
      setProfileMessage("Not signed in.");
      return;
    }
    const fn = fullName.trim();
    if (!fn) {
      setProfileMessage("Please enter your name.");
      return;
    }
    const bizChanged = Boolean(businessId) && businessName.trim() !== initialBusinessName.trim();
    if (bizChanged) {
      setConfirmBizOpen(true);
      return;
    }
    void applyProfileSave(false);
  };

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
      {confirmBizOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-biz-title"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) setConfirmBizOpen(false);
          }}
        >
          <div className="modal-card">
            <h2 id="confirm-biz-title" className="modal-card__title">
              Update business name?
            </h2>
            <p className="modal-card__body">
              Are you sure you want to change your business name? This will appear to travelers in the app, on
              listings, and in booking details.
            </p>
            <div className="modal-card__actions">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmBizOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={profileBusy}
                onClick={() => void applyProfileSave(true)}
              >
                {profileBusy ? "Saving…" : "Yes, update"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <h1 className="dash-title" style={{ marginBottom: 8 }}>
          Account settings
        </h1>
        <p className="dash-sub" style={{ marginBottom: 0 }}>
          Update your profile and sign-in password. For GCash / Maya account name, number, and QR shown to travelers,
          open <Link to="/settings/e-wallet">E-Wallet settings</Link>. Contact support and display options stay in the
          sidebar under Settings.
        </p>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <span className="card__title">Profile info</span>
        <span className="card__subtitle">
          {accountEmail ? `Signed in as ${accountEmail}` : "Loading account…"}
        </span>
        {profileLoading ? (
          <p className="dash-sub" style={{ marginTop: 12 }}>
            Loading profile…
          </p>
        ) : (
          <form className="owner-settings-form" onSubmit={(ev) => void onSaveProfile(ev)}>
            <label className="owner-settings-form__label" htmlFor="profile-name">
              Name
            </label>
            <input
              id="profile-name"
              className="owner-settings-form__input"
              value={fullName}
              onChange={(ev) => setFullName(ev.target.value)}
              placeholder="Your full name"
              autoComplete="name"
            />

            <label className="owner-settings-form__label" htmlFor="profile-business">
              Business name
            </label>
            {businessId ? (
              <>
                <input
                  id="profile-business"
                  className="owner-settings-form__input"
                  value={businessName}
                  onChange={(ev) => setBusinessName(ev.target.value)}
                  placeholder="Business or property name"
                  autoComplete="organization"
                />
                <p className="owner-settings-form__hint">
                  Shown in the sidebar, on your listings, and to travelers. Uses your first listing (oldest) if you have
                  several.
                </p>
              </>
            ) : (
              <>
                <input
                  id="profile-business"
                  className="owner-settings-form__input"
                  value=""
                  disabled
                  placeholder="Add a listing first"
                />
                <p className="owner-settings-form__hint">Create a listing to set your business name here.</p>
              </>
            )}

            <label className="owner-settings-form__label" htmlFor="profile-email">
              Email
            </label>
            <input
              id="profile-email"
              className="owner-settings-form__input"
              type="email"
              value={accountEmail ?? ""}
              disabled
              readOnly
              placeholder="you@email.com"
            />
            <p className="owner-settings-form__hint">Email sign-in cannot be changed here.</p>

            {profileMessage ? (
              <p
                className={`owner-settings-form__msg ${
                  profileMessage.includes("success") ? "owner-settings-form__msg--ok" : ""
                }`}
              >
                {profileMessage}
              </p>
            ) : null}
            <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }} disabled={profileBusy}>
              {profileBusy ? "Saving…" : "Save profile"}
            </button>
          </form>
        )}
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
          <PasswordInput
            id="cur-pw"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            placeholder="Enter current password"
            disabled={busy}
          />
          <label className="owner-settings-form__label" htmlFor="new-pw">
            New password
          </label>
          <PasswordInput
            id="new-pw"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            placeholder="New password (min. 6 characters)"
            disabled={busy}
          />
          <label className="owner-settings-form__label" htmlFor="conf-pw">
            Confirm new password
          </label>
          <PasswordInput
            id="conf-pw"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            placeholder="Re-enter new password"
            disabled={busy}
          />
          {message ? (
            <p className={`owner-settings-form__msg ${message.includes("success") ? "owner-settings-form__msg--ok" : ""}`}>
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
