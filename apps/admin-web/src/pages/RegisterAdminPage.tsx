import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthVisual } from "../components/AuthVisual";
import { supabase } from "../lib/supabaseClient";

/**
 * Creates a user with profiles.role = admin (via auth metadata).
 * Lock down in production: disable sign-ups or restrict by invite-only in Supabase Auth settings.
 */
export function RegisterAdminPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    const { error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: "admin",
        },
      },
    });
    setBusy(false);
    if (signErr) {
      setError(signErr.message);
      return;
    }
    navigate("/login");
  };

  return (
    <div className="auth-split">
      <AuthVisual />
      <div className="auth-split__panel">
        <div className="auth-card">
          <h2>Create Account</h2>
          <p className="auth-lead">Register a new admin account.</p>
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="fullName">Full Name</label>
              <div className="input-with-icon">
                <span>👤</span>
                <input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <div className="input-with-icon">
                <span>✉</span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-with-icon">
                <span>🔒</span>
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="toggle-pw"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label="Toggle password"
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="confirm">Confirm Password</label>
              <div className="input-with-icon">
                <span>🔒</span>
                <input
                  id="confirm"
                  type={showPw ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
            </div>
            {error && <div style={{ color: "#dc2626", fontSize: 14, marginBottom: 12 }}>{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Creating…" : "Register"}
            </button>
          </form>
          <p className="auth-footer">
            Already have an account? <Link to="/login">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
