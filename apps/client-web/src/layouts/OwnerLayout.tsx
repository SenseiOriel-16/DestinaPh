import { NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useState } from "react";
import { OwnerMessageBell } from "../components/OwnerMessageBell";
import { OwnerNotificationBell } from "../components/OwnerNotificationBell";
import { supabase } from "../lib/supabaseClient";
import { primeNotificationAudioFromUserGesture } from "../lib/notificationSound";
import { useLastSeenPing } from "../hooks/useLastSeenPing";

const OWNER_THEME_KEY = "destinaph_owner_dark";

const mainNav = [
  { to: "/", label: "Dashboard", icon: "\u25A4", end: true },
  { to: "/listings", label: "Manage Listings", icon: "\u25CE" },
  { to: "/reservations", label: "Reservations", icon: "\u{1F4C5}" },
  { to: "/analytics", label: "Analytics", icon: "\u{1F4CA}" },
];

function titleForPath(pathname: string): { title: string } {
  if (pathname === "/") {
    return { title: "Dashboard" };
  }
  if (pathname === "/listings") {
    return { title: "Manage Listings" };
  }
  if (pathname === "/reservations") {
    return { title: "Reservations" };
  }
  if (pathname === "/listings/new") {
    return { title: "Add New Listing" };
  }
  if (/^\/listings\/[^/]+$/.test(pathname) && pathname !== "/listings/new") {
    return { title: "Edit Listing" };
  }
  if (pathname === "/settings" || pathname === "/settings/") {
    return { title: "Account settings" };
  }
  if (pathname === "/settings/e-wallet") {
    return { title: "E-Wallet Settings" };
  }
  if (pathname === "/analytics") {
    return { title: "Analytics" };
  }
  if (pathname === "/support") {
    return { title: "Support" };
  }
  return { title: "DestinaPH Business" };
}

export function OwnerLayout() {
  useLastSeenPing();
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [businessName, setBusinessName] = useState("Your business");
  const [avatarLetter, setAvatarLetter] = useState("B");
  const [welcomeName, setWelcomeName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(() => location.pathname.startsWith("/settings"));
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(OWNER_THEME_KEY) === "1";
  });

  const onSettingsPath = location.pathname.startsWith("/settings");

  useEffect(() => {
    const onFirstGesture = () => {
      void primeNotificationAudioFromUserGesture();
    };
    document.addEventListener("pointerdown", onFirstGesture, { once: true, capture: true });
    return () => document.removeEventListener("pointerdown", onFirstGesture, { capture: true } as AddEventListenerOptions);
  }, []);

  useEffect(() => {
    if (onSettingsPath) setSettingsOpen(true);
  }, [onSettingsPath]);

  useEffect(() => {
    document.documentElement.classList.toggle("owner-dark", darkMode);
    try {
      window.localStorage.setItem(OWNER_THEME_KEY, darkMode ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [darkMode]);

  const loadOwnerSidebar = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const u = data.user;
    if (!u) return;
    const meta = u.user_metadata as { full_name?: string; business_name?: string } | undefined;
    const nameFromMeta = meta?.full_name?.trim() || u.email?.split("@")[0] || "Partner";

    const uid = u.id;
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle();
    const displayName = prof?.full_name?.trim() || nameFromMeta;
    setWelcomeName(displayName);
    setAvatarLetter(displayName.slice(0, 1).toUpperCase());

    const { data: rows } = await supabase
      .from("businesses")
      .select("name")
      .eq("owner_id", uid)
      .order("created_at", { ascending: true });
    const list = rows ?? [];
    const display =
      meta?.business_name?.trim() ||
      (list[0] as { name?: string } | undefined)?.name ||
      "Your business";
    setBusinessName(display);
  }, []);

  useEffect(() => {
    void loadOwnerSidebar();
  }, [loadOwnerSidebar]);

  useEffect(() => {
    const onUpdated = () => {
      void loadOwnerSidebar();
    };
    window.addEventListener("destinaph-owner-profile-updated", onUpdated);
    return () => window.removeEventListener("destinaph-owner-profile-updated", onUpdated);
  }, [loadOwnerSidebar]);

  const signOut = async () => {
    if (!window.confirm("Are you sure you want to log out?")) return;
    await supabase.auth.signOut();
    navigate("/login");
  };

  const { title } = titleForPath(location.pathname);
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 6);
  const rangeStr = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const animatedOutlet = useMemo(() => {
    if (!isValidElement(outlet)) return outlet;
    const prev = outlet.props.className;
    const merged = [typeof prev === "string" ? prev : "", "ui-route-enter"].filter(Boolean).join(" ");
    return cloneElement(outlet, { key: location.pathname, className: merged });
  }, [location.pathname, outlet]);

  return (
    <div className="owner-shell">
      {sidebarOpen && (
        <button
          type="button"
          className={`owner-overlay ${sidebarOpen ? "owner-overlay--open" : ""}`}
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`owner-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="owner-sidebar__brand">
          <img
            className="owner-sidebar__brand-img"
            src="/system-icon.png"
            width={40}
            height={40}
            alt=""
            decoding="async"
          />
          <div>
            <h1>DestinaPH</h1>
            <span>Business</span>
          </div>
        </div>
        <nav className="owner-nav">
          {mainNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="owner-nav__icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          <div className="owner-nav__group">
            <button
              type="button"
              className={`owner-nav__parent ${onSettingsPath ? "active" : ""}`}
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((o) => !o)}
            >
              <span className="owner-nav__icon">{"\u2699"}</span>
              <span className="owner-nav__parent-label">Settings</span>
              <span className={`owner-nav__chevron ${settingsOpen ? "owner-nav__chevron--open" : ""}`} aria-hidden>
                {"\u25BC"}
              </span>
            </button>
            {settingsOpen && (
              <div className="owner-nav__sub">
                <NavLink
                  to="/settings"
                  end
                  className={({ isActive }) => (isActive ? "active" : "")}
                  onClick={() => setSidebarOpen(false)}
                >
                  Account settings
                </NavLink>
                <NavLink
                  to="/settings/e-wallet"
                  className={({ isActive }) => (isActive ? "active" : "")}
                  onClick={() => setSidebarOpen(false)}
                >
                  E-Wallet settings
                </NavLink>
                <div className="owner-nav__sub-row">
                  <span className="owner-nav__sub-label">Dark mode</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={darkMode}
                    className={`owner-nav__switch ${darkMode ? "owner-nav__switch--on" : ""}`}
                    onClick={() => setDarkMode((d) => !d)}
                  >
                    <span className="owner-nav__switch-knob" />
                  </button>
                </div>
                <NavLink
                  to="/support"
                  className={({ isActive }) => (isActive ? "active" : "")}
                  onClick={() => setSidebarOpen(false)}
                >
                  Contact support
                </NavLink>
              </div>
            )}
          </div>
        </nav>
        <div className="owner-sidebar__card">
          <div className="owner-sidebar__avatar">{avatarLetter}</div>
          <div className="owner-sidebar__card-meta">
            <strong title={businessName}>{businessName}</strong>
            <small>Business Owner</small>
          </div>
        </div>
        <button type="button" className="owner-sidebar__logout" onClick={() => void signOut()}>
          Log out
        </button>
      </aside>
      <div className="owner-main">
        <header className="owner-topbar">
          <div className="owner-topbar__left">
            <button
              type="button"
              className="owner-topbar__menu"
              aria-label="Menu"
              onClick={() => setSidebarOpen((o) => !o)}
            >
              {"\u2630"}
            </button>
            <div className="owner-topbar__titles">
              <h2>{title}</h2>
              {location.pathname === "/" && welcomeName && (
                <p>Welcome back, {welcomeName}! Here&apos;s what&apos;s happening with your business.</p>
              )}
            </div>
          </div>
          <div className="owner-topbar__right">
            <OwnerMessageBell />
            <OwnerNotificationBell />
            <div className="owner-topbar__avatar" aria-hidden>
              {avatarLetter}
              <span className="owner-topbar__chev">{"\u25BE"}</span>
            </div>
            <div className="owner-topbar__date">{rangeStr}</div>
          </div>
        </header>
        <div className="owner-main__body">
          <div className="owner-page-stage">{animatedOutlet}</div>
        </div>
      </div>
    </div>
  );
}
