import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const nav = [
  { to: "/", label: "Dashboard", icon: "▤", end: true },
  { to: "/listings", label: "Manage Listings", icon: "◎" },
  { to: "/upgrade", label: "Premium", icon: "★" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

function titleForPath(pathname: string): { title: string } {
  if (pathname === "/") {
    return { title: "Dashboard" };
  }
  if (pathname === "/listings") {
    return { title: "Manage Listings" };
  }
  if (pathname === "/listings/new") {
    return { title: "Add New Listing" };
  }
  if (/^\/listings\/[^/]+$/.test(pathname) && pathname !== "/listings/new") {
    return { title: "Edit Listing" };
  }
  if (pathname === "/upgrade") {
    return { title: "Premium" };
  }
  if (pathname === "/settings") {
    return { title: "Settings" };
  }
  if (pathname === "/analytics") {
    return { title: "Analytics" };
  }
  return { title: "DestinaPH Business" };
}

export function OwnerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [businessName, setBusinessName] = useState("Your business");
  const [anyPremium, setAnyPremium] = useState(false);
  const [avatarLetter, setAvatarLetter] = useState("B");
  const [welcomeName, setWelcomeName] = useState("");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return;
      const meta = u.user_metadata as { full_name?: string; business_name?: string } | undefined;
      const nameFromMeta = meta?.full_name?.trim() || u.email?.split("@")[0] || "Partner";
      setAvatarLetter(nameFromMeta.slice(0, 1).toUpperCase());

      const uid = u.id;
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle();
      setWelcomeName(prof?.full_name?.trim() || nameFromMeta);
      const { data: rows } = await supabase
        .from("businesses")
        .select("name,is_premium")
        .eq("owner_id", uid)
        .order("created_at", { ascending: true });
      const list = rows ?? [];
      const display =
        meta?.business_name?.trim() ||
        (list[0] as { name?: string } | undefined)?.name ||
        "Your business";
      setBusinessName(display);
      setAnyPremium(list.some((r: { is_premium?: boolean }) => r.is_premium));
    })();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const { title } = titleForPath(location.pathname);
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 6);
  const rangeStr = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

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
          {nav.map((item) => (
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
        </nav>
        <div className="owner-sidebar__card">
          <div className="owner-sidebar__avatar">{avatarLetter}</div>
          <div className="owner-sidebar__card-meta">
            <strong title={businessName}>{businessName}</strong>
            <small>Business Owner</small>
            {anyPremium && <span className="owner-premium-pill">Premium</span>}
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
              ☰
            </button>
            <div className="owner-topbar__titles">
              <h2>{title}</h2>
              {location.pathname === "/" && welcomeName && (
                <p>Welcome back, {welcomeName}! Here&apos;s what&apos;s happening with your business.</p>
              )}
            </div>
          </div>
          <div className="owner-topbar__right">
            <button type="button" className="owner-topbar__bell" aria-label="Notifications">
              🔔
              <span className="owner-topbar__badge owner-topbar__badge--green">3</span>
            </button>
            <div className="owner-topbar__avatar" aria-hidden>
              {avatarLetter}
              <span className="owner-topbar__chev">▾</span>
            </div>
            <div className="owner-topbar__date">{rangeStr}</div>
          </div>
        </header>
        <div className="owner-main__body">
          <Outlet key={location.pathname} />
        </div>
      </div>
    </div>
  );
}
