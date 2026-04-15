import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthSplitLayout } from "../components/AuthSplitLayout";
import { AuthCardSkeleton } from "../components/PageSkeletons";
import { supabase } from "../lib/supabaseClient";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [canEnter, setCanEnter] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
          if (!cancelled) setCanEnter(false);
          return;
        }
        const { data: profile, error: pErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        if (pErr || !profile) {
          if (!cancelled) setCanEnter(false);
          return;
        }
        if (!cancelled) setCanEnter(profile.role === "admin");
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) {
    return <AuthCardSkeleton message="Checking your session…" />;
  }

  if (canEnter) {
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
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.session.user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      await supabase.auth.signOut();
      setError("This account is not an administrator.");
      setBusy(false);
      return;
    }
    navigate("/");
  };

  return (
    <AuthSplitLayout>
      <div className="auth-card">
          <h2>Welcome Back!</h2>
          <p className="auth-lead">Sign in to your admin account.</p>
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <div className="input-with-icon">
                <span>✉</span>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="toggle-pw"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div className="auth-row">
              <label>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Remember me
              </label>
              <Link to="/forgot-password">Forgot Password?</Link>
            </div>
            {error && <div style={{ color: "#dc2626", fontSize: 14, marginBottom: 14 }}>{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>
          <p className="auth-footer">
            Don&apos;t have an account?{" "}
            <Link to="/register">Register here</Link>
          </p>
        </div>
    </AuthSplitLayout>
  );
}
