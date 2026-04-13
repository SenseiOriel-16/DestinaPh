/** Full-screen and in-page loading skeletons for the admin console. */

import { AuthSplitLayout } from "./AuthSplitLayout";

export function AdminShellSkeleton() {
  return (
    <div className="admin-shell" aria-busy="true" aria-live="polite" aria-label="Loading admin workspace">
      <aside className="admin-sidebar admin-sidebar--skeleton" aria-hidden>
        <div className="sk-side-brand">
          <span className="sk-block sk-block--circle" />
          <span className="sk-block sk-block--brand-text" />
        </div>
        <div className="sk-side-nav">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="sk-block sk-block--nav" />
          ))}
        </div>
        <div className="sk-side-footer">
          <span className="sk-block sk-block--avatar" />
          <div className="sk-side-footer-lines">
            <span className="sk-line sk-line--short" />
            <span className="sk-line sk-line--shorter" />
          </div>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar" aria-hidden>
          <div className="admin-topbar__left">
            <span className="sk-block sk-block--icon" />
          </div>
          <div className="admin-topbar__right">
            <span className="sk-block sk-block--bell" />
            <span className="sk-block sk-block--pill" />
          </div>
        </header>
        <div className="admin-main__body">
          <AdminDashboardSkeleton />
        </div>
      </div>
    </div>
  );
}

export function AuthCardSkeleton({ message = "Checking your session…" }: { message?: string }) {
  return (
    <AuthSplitLayout>
      <div className="auth-card sk-auth-card" role="status" aria-live="polite" aria-busy="true">
        <span className="sk-line sk-line--h2" />
        <span className="sk-line sk-line--wide" style={{ marginTop: 14 }} />
        <span className="sk-line sk-line--full" style={{ marginTop: 20 }} />
        <span className="sk-line sk-line--full" style={{ marginTop: 12 }} />
        <span className="sk-block sk-block--btn" style={{ marginTop: 24 }} />
        <p className="sk-auth-hint">{message}</p>
      </div>
    </AuthSplitLayout>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <div className="page page-stack sk-content" aria-hidden>
      <div>
        <span className="sk-line sk-line--dash-title" />
        <span className="sk-line sk-line--dash-sub" />
      </div>
      <div className="stat-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stat-card sk-stat-card">
            <span className="sk-line sk-line--label" />
            <span className="sk-line sk-line--value" />
            <span className="sk-line sk-line--tiny" />
          </div>
        ))}
      </div>
      <div className="dash-grid-2">
        <div className="card sk-card-tall">
          <span className="sk-line sk-line--card-title" />
          <span className="sk-line sk-line--card-sub" />
          <span className="sk-block sk-block--chart" />
        </div>
        <div className="card sk-card-tall">
          <span className="sk-line sk-line--card-title" />
          <span className="sk-line sk-line--card-sub" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="sk-recent-row">
              <span className="sk-block sk-block--avatar-sm" />
              <div className="sk-recent-text">
                <span className="sk-line sk-line--wide" />
                <span className="sk-line sk-line--sub" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminTablePageSkeleton() {
  return (
    <div className="page page-stack sk-content" aria-hidden>
      <header className="page-header">
        <span className="sk-line sk-line--dash-title" />
        <span className="sk-line sk-line--dash-sub" />
      </header>
      <div className="card" style={{ padding: 0 }}>
        <div className="sk-table">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="sk-table-row">
              <span className="sk-line sk-line--table-cell" />
              <span className="sk-line sk-line--table-cell" />
              <span className="sk-line sk-line--table-cell-short" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminFormTableSkeleton() {
  return (
    <div className="page page-stack sk-content" aria-hidden>
      <header className="page-header">
        <span className="sk-line sk-line--dash-title" />
        <span className="sk-line sk-line--dash-sub" />
      </header>
      <div className="card sk-form-card">
        <span className="sk-line sk-line--h3" />
        {[0, 1].map((i) => (
          <div key={i} className="sk-field">
            <span className="sk-line sk-line--label" />
            <span className="sk-block sk-block--input" />
          </div>
        ))}
        <span className="sk-block sk-block--btn-inline" />
      </div>
      <div className="card" style={{ padding: 0, marginTop: 16 }}>
        <div className="sk-table">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="sk-table-row">
              <span className="sk-line sk-line--table-cell" />
              <span className="sk-line sk-line--table-cell" />
              <span className="sk-line sk-line--table-cell-short" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminPlansSkeleton() {
  return (
    <div className="page page-stack sk-content" aria-hidden>
      <header className="page-header">
        <span className="sk-line sk-line--dash-title" />
        <span className="sk-line sk-line--dash-sub" />
      </header>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
        {[0, 1].map((i) => (
          <div key={i} className="card sk-plan-card">
            <span className="sk-line sk-line--h3" />
            <span className="sk-line sk-line--wide" />
            {[0, 1, 2].map((j) => (
              <div key={j} className="sk-field">
                <span className="sk-line sk-line--label" />
                <span className="sk-block sk-block--input" />
              </div>
            ))}
            <span className="sk-block sk-block--btn" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminReportsSkeleton() {
  return (
    <div className="page page-stack sk-content" aria-hidden>
      <header className="admin-page-hero admin-page-hero--compact">
        <div style={{ flex: 1 }}>
          <span className="sk-line sk-line--dash-title" style={{ maxWidth: 120, marginBottom: 10 }} />
          <span className="sk-line sk-line--dash-title" style={{ maxWidth: 220 }} />
          <span className="sk-line sk-line--dash-sub" style={{ marginTop: 10 }} />
        </div>
      </header>
      <div className="card card--flush sk-card-tall">
        <span className="sk-line sk-line--card-title" style={{ maxWidth: 200 }} />
        <span className="sk-block sk-block--tab" style={{ marginTop: 12, maxWidth: 400 }} />
      </div>
      <div className="sk-mini-grid" style={{ marginTop: 8 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="sk-mini-card" />
        ))}
      </div>
      <div className="card sk-card-tall" style={{ padding: 0, marginTop: 8 }}>
        <span className="sk-line sk-line--card-title" style={{ margin: "16px 18px 0" }} />
        <div className="sk-table" style={{ padding: "8px 16px 20px" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="sk-table-row">
              <span className="sk-line sk-line--table-cell" />
              <span className="sk-line sk-line--table-cell-short" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminSettingsSkeleton() {
  return (
    <div className="page page-stack sk-content" aria-hidden>
      <div>
        <span className="sk-line sk-line--dash-title" />
        <span className="sk-line sk-line--dash-sub" />
      </div>
      <div className="settings-link-grid">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="settings-link-card sk-settings-link">
            <span className="sk-line sk-line--h3" />
            <span className="sk-line sk-line--wide" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminManageClientsSkeleton() {
  return (
    <div className="page page--wide sk-content" aria-hidden>
      <header className="manage-clients__header">
        <span className="sk-line sk-line--dash-title" style={{ maxWidth: 280 }} />
        <span className="sk-line sk-line--dash-sub" />
      </header>
      <section className="manage-clients__section">
        <span className="sk-line sk-line--h3" />
        <span className="sk-line sk-line--wide" style={{ marginBottom: 14 }} />
        <div className="card manage-clients__table-wrap">
          <div className="sk-table">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="sk-table-row">
                <span className="sk-line sk-line--table-cell" />
                <span className="sk-line sk-line--table-cell" />
                <span className="sk-line sk-line--table-cell-short" />
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="manage-clients__section">
        <span className="sk-line sk-line--h3" />
        <span className="sk-line sk-line--wide" style={{ marginBottom: 14 }} />
        <div className="card manage-clients__table-wrap">
          <div className="sk-table">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="sk-table-row">
                <span className="sk-line sk-line--table-cell" />
                <span className="sk-line sk-line--table-cell" />
                <span className="sk-line sk-line--table-cell-short" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function AdminPremiumSkeleton() {
  return (
    <div className="page page-stack sk-content" aria-hidden>
      <header className="page-header">
        <span className="sk-line sk-line--dash-title" />
        <span className="sk-line sk-line--dash-sub" style={{ maxWidth: 640 }} />
      </header>
      <div className="segment-tabs">
        <span className="sk-block sk-block--tab" style={{ width: 100 }} />
        <span className="sk-block sk-block--tab" style={{ width: 100 }} />
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="sk-table">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="sk-table-row sk-table-row--wide">
              <span className="sk-line sk-line--table-cell" />
              <span className="sk-line sk-line--table-cell-short" />
              <span className="sk-line sk-line--table-cell-short" />
              <span className="sk-line sk-line--table-cell-short" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
