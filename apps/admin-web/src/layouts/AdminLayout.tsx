import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AdminMessageBell } from "../components/AdminMessageBell";
import { AdminNotificationBell } from "../components/AdminNotificationBell";
import { SoundEnablePrompt } from "../components/SoundEnablePrompt";
import { supabase } from "../lib/supabaseClient";
import { primeNotificationAudioFromUserGesture } from "../lib/notificationSound";

const mainNav = [
  { to: "/", label: "Dashboard", icon: "\u25A4", end: true },
  { to: "/users", label: "Users", icon: "\u{1F465}" },
  { to: "/listings", label: "Manage Clients", icon: "\u25CE" },
  { to: "/reports", label: "Analytics", icon: "\u{1F4CA}" },
  { to: "/support", label: "Support", icon: "\u{1F4AC}" },
];

const settingsSubNav = [
  { to: "/settings/categories", label: "Categories" },
  { to: "/settings/municipalities", label: "Municipalities" },
  { to: "/settings/featured", label: "Featured" },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(() => location.pathname.startsWith("/settings"));
  const [userLabel, setUserLabel] = useState("Admin");
  const [userEmail, setUserEmail] = useState("");

  const onSettingsPath = location.pathname.startsWith("/settings");

  useEffect(() => {
    if (onSettingsPath) setSettingsOpen(true);
  }, [onSettingsPath]);

  useEffect(() => {
    const onFirstGesture = () => {
      void primeNotificationAudioFromUserGesture();
    };
    document.addEventListener("pointerdown", onFirstGesture, { once: true, capture: true });
    return () => document.removeEventListener("pointerdown", onFirstGesture, { capture: true } as AddEventListenerOptions);
  }, []);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return;
      setUserEmail(u.email ?? "");
      const meta = u.user_metadata as { full_name?: string } | undefined;
      setUserLabel(meta?.full_name?.trim() || u.email?.split("@")[0] || "Admin");
    })();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="admin-shell">
      <SoundEnablePrompt />
      {sidebarOpen && (
        <button
          type="button"
          className={`admin-overlay ${sidebarOpen ? "admin-overlay--open" : ""}`}
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="admin-sidebar__brand">
          <img
            className="admin-sidebar__brand-img"
            src="/system-icon.png"
            width={40}
            height={40}
            alt=""
            decoding="async"
          />
          <div>
            <h1>DestinaPH</h1>
            <span>Admin</span>
          </div>
        </div>
        <nav className="admin-nav">
          {mainNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="admin-nav__icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          <div className="admin-nav__group">
            <button
              type="button"
              className={`admin-nav__parent ${onSettingsPath ? "active" : ""}`}
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((o) => !o)}
            >
              <span className="admin-nav__icon">{"\u2699"}</span>
              <span className="admin-nav__parent-label">Settings</span>
              <span className={`admin-nav__chevron ${settingsOpen ? "admin-nav__chevron--open" : ""}`} aria-hidden>
                {"\u25BC"}
              </span>
            </button>
            {settingsOpen && (
              <div className="admin-nav__sub">
                {settingsSubNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => (isActive ? "active" : "")}
                    onClick={() => setSidebarOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>
        <div className="admin-sidebar__user">
          <div className="admin-sidebar__avatar">{userLabel.slice(0, 1).toUpperCase()}</div>
          <div className="admin-sidebar__user-meta">
            <strong title={userEmail}>{userLabel}</strong>
            <small>Super Admin</small>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => void signOut()} style={{ padding: "6px 10px", fontSize: 12 }}>
            Out
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar__left">
            <button
              type="button"
              className="admin-topbar__menu"
              aria-label="Menu"
              onClick={() => setSidebarOpen((o) => !o)}
            >
              {"\u2630"}
            </button>
          </div>
          <div className="admin-topbar__right">
            <AdminMessageBell />
            <AdminNotificationBell />
            <div className="admin-topbar__date">{today}</div>
          </div>
        </header>
        <div className="admin-main__body">
          <Outlet key={location.pathname} />
        </div>
      </div>
    </div>
  );
}
