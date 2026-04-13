import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const nav = [
  { to: "/", label: "Dashboard", icon: "▤", end: true },
  { to: "/listings", label: "Manage Clients", icon: "◎" },
  { to: "/premium-payments", label: "Premium payments", icon: "💳" },
  { to: "/reports", label: "Analytics", icon: "📊" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userLabel, setUserLabel] = useState("Admin");
  const [userEmail, setUserEmail] = useState("");

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
          {nav.map((item) => (
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
              ☰
            </button>
          </div>
          <div className="admin-topbar__right">
            <button type="button" className="admin-topbar__bell" aria-label="Notifications">
              🔔
              <span className="admin-topbar__badge">3</span>
            </button>
            <div className="admin-topbar__date">{today}</div>
          </div>
        </header>
        <Outlet key={location.pathname} />
      </div>
    </div>
  );
}
