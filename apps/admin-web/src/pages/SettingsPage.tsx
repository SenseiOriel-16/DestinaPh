import { Link } from "react-router-dom";

const links = [
  { to: "/premium-payments", title: "Premium payments", desc: "Review owner upgrade submissions & proof" },
  { to: "/approvals", title: "Approvals", desc: "Pending business owner accounts" },
  { to: "/categories", title: "Categories", desc: "Nature, resorts, food & more" },
  { to: "/municipalities", title: "Municipalities", desc: "Regions & towns" },
  { to: "/featured", title: "Featured", desc: "Spotlight on home" },
  { to: "/plans", title: "Subscription plans", desc: "Free vs premium" },
];

export function SettingsPage() {
  return (
    <div className="page">
      <h1 className="dash-title">Settings</h1>
      <p className="dash-sub">Platform tools and configuration.</p>
      <div className="settings-link-grid">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="settings-link-card">
            <strong>{l.title}</strong>
            <span>{l.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
