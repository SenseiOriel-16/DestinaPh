import { Link } from "react-router-dom";

export function SettingsPage() {
  return (
    <div className="page">
      <h1 className="dash-title" style={{ marginBottom: 8 }}>
        Account & tools
      </h1>
      <p className="dash-sub">Manage your workspace and dig into performance data.</p>
      <div className="settings-grid">
        <Link to="/analytics" className="settings-card">
          <span className="settings-card__icon">📊</span>
          <div>
            <strong>Analytics</strong>
            <p>Views and taps across all listings.</p>
          </div>
        </Link>
        <a href="mailto:support@destinaph.example" className="settings-card">
          <span className="settings-card__icon">✉</span>
          <div>
            <strong>Contact support</strong>
            <p>Get help with listings or verification.</p>
          </div>
        </a>
      </div>
    </div>
  );
}
