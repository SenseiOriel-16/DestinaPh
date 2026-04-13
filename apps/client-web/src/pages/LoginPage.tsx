import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthVisual } from "../components/AuthVisual";
import { supabase } from "../lib/supabaseClient";

type ProfileRow = {
  role: string;
  owner_approval_status?: string | null;
  is_suspended?: boolean | null;
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [canEnterDashboard, setCanEnterDashboard] = useState(false);
  const [sessionWrongRole, setSessionWrongRole] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const st = location.state as { pendingOwnerApproval?: boolean } | undefined;
    if (st?.pendingOwnerApproval) {
      setBanner(
        "Account created. An admin must approve your business owner account before you can sign in here.",
      );
      navigate("/login", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
          if (!cancelled) {
            setCanEnterDashboard(false);
            setSessionWrongRole(false);
          }
          return;
        }
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("role, owner_approval_status, is_suspended")
          .eq("id", session.user.id)
          .maybeSingle();
        if (profileErr) {
          console.warn("[DestinaPH] profiles:", profileErr.message);
          if (!cancelled) {
            setCanEnterDashboard(false);
            setSessionWrongRole(false);
          }
          return;
        }
        const p = profile as ProfileRow | null;
        const gate = p?.owner_approval_status ?? "approved";
        const suspended = !!p?.is_suspended;
        const isApprovedOwner =
          p?.role === "business_owner" && gate === "approved" && !suspended;
        if (!cancelled) {
          setCanEnterDashboard(!!isApprovedOwner);
          setSessionWrongRole(!!session && p?.role === "business_owner" && !isApprovedOwner);
        }
      } catch (e) {
        console.warn("[DestinaPH] session check:", e);
        if (!cancelled) {
          setCanEnterDashboard(false);
          setSessionWrongRole(false);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) {
    return (
      <div className="owner-route-loading">
        <div className="card">Loading…</div>
      </div>
    );
  }

  if (canEnterDashboard) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr || !data.session) {
      setError(signErr?.message ?? "Unable to sign in");
      setBusy(false);
      return;
    }
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("role, owner_approval_status, is_suspended")
      .eq("id", data.session.user.id)
      .maybeSingle();
    if (pErr) {
      setError(pErr.message);
      setBusy(false);
      return;
    }
    const p = profile as ProfileRow | null;
    if (p?.role !== "business_owner") {
      await supabase.auth.signOut();
      setError("Use a business owner account for this console.");
      setBusy(false);
      return;
    }
    const gate = p.owner_approval_status ?? "approved";
    if (gate === "pending") {
      await supabase.auth.signOut();
      setError("Your account is waiting for admin approval. You will be able to sign in once approved.");
      setBusy(false);
      return;
    }
    if (gate === "rejected") {
      await supabase.auth.signOut();
      setError("This business owner registration was not approved. Contact support if you need help.");
      setBusy(false);
      return;
    }
    if (p.is_suspended) {
      await supabase.auth.signOut();
      setError("This account has been suspended. Contact support if you need help.");
      setBusy(false);
      return;
    }
    navigate("/");
  };

  const signOutOtherSession = async () => {
    await supabase.auth.signOut();
    setCanEnterDashboard(false);
    setSessionWrongRole(false);
    setError(null);
  };

  return (
    <div className="auth-split">
      <AuthVisual />
      <div className="auth-split__panel">
        <div className="auth-card">
          <h2>Welcome back</h2>
          <p className="auth-lead">Sign in to your business account to manage listings and reach travelers.</p>
          {banner && (
            <div
              className="card"
              style={{
                marginBottom: 16,
                background: "#ecfdf5",
                borderColor: "#6ee7b7",
                fontSize: 14,
                color: "#065f46",
              }}
            >
              {banner}
            </div>
          )}
          {sessionWrongRole && (
            <p style={{ marginBottom: 16, fontSize: 14, color: "var(--muted)" }}>
              You are signed in, but business owner access is not approved yet, the account is suspended, or this is not
              a business owner account. Sign out if you need to log in with a different email.
            </p>
          )}
          <form onSubmit={onSubmit}>
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
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-with-icon">
                <span>🔒</span>
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="toggle-pw"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  onClick={() => setShowPw((s) => !s)}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <div className="auth-row">
              <label>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me
              </label>
              <a href="#forgot" onClick={(e) => e.preventDefault()}>
                Forgot password?
              </a>
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>
          <div className="auth-footer">
            <button type="button" className="btn-text" onClick={() => void signOutOtherSession()}>
              Sign out current session
            </button>
            <p style={{ marginTop: 16, marginBottom: 0 }}>
              Don&apos;t have an account? <Link to="/register">Register here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
