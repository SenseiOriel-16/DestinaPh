/** Full-screen and in-page loading skeletons for the owner console. */

import { AuthSplitLayout } from "./AuthSplitLayout";

export function OwnerShellSkeleton() {
  return (
    <div className="owner-shell" aria-busy="true" aria-live="polite" aria-label="Loading workspace">
      <aside className="owner-sidebar owner-sidebar--skeleton" aria-hidden>
        <div className="sk-side-brand">
          <span className="sk-block sk-block--circle" />
          <span className="sk-block sk-block--brand-text" />
        </div>
        <div className="sk-side-nav">
          {[0, 1, 2, 3].map((i) => (
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
      <div className="owner-main">
        <header className="owner-topbar" aria-hidden>
          <div className="owner-topbar__left">
            <span className="sk-block sk-block--icon" />
            <div className="owner-topbar__titles">
              <span className="sk-line sk-line--title" />
              <span className="sk-line sk-line--sub" />
            </div>
          </div>
          <div className="owner-topbar__right">
            <span className="sk-block sk-block--bell" />
            <span className="sk-block sk-block--pill" />
          </div>
        </header>
        <div className="owner-main__body">
          <ClientDashboardSkeleton />
        </div>
      </div>
    </div>
  );
}

export function AuthCardSkeleton({ message = "Checking your session…" }: { message?: string }) {
  return (
    <AuthSplitLayout variant="client">
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

export function ClientDashboardSkeleton() {
  return (
    <div className="page page--flush-top page-stack sk-content" aria-hidden>
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
          <span className="sk-block sk-block--thumb" />
          <span className="sk-line sk-line--h3" />
          <span className="sk-line sk-line--wide" />
        </div>
      </div>
    </div>
  );
}

export function ClientListingsSkeleton() {
  return (
    <div className="page page--flush-top owner-listings sk-content" aria-hidden>
      <header className="owner-listings__hero">
        <div className="owner-listings__hero-main">
          <span className="sk-line sk-line--eyebrow" />
          <span className="sk-line sk-line--dash-title" />
          <span className="sk-line sk-line--dash-sub" />
        </div>
        <span className="sk-block sk-block--btn-inline owner-listings__cta-skel" />
      </header>
      <div className="tabs sk-tabs">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="sk-block sk-block--tab" />
        ))}
      </div>
      <div className="listing-owner-card sk-listing-card">
        <span className="sk-block sk-block--listing-banner" />
        <div className="listing-owner-card__body">
          <div className="listing-owner-card__title-row">
            <span className="sk-line sk-line--h2" />
            <span className="sk-block sk-block--pill-sm" />
          </div>
          <span className="sk-line sk-line--wide" />
          <div className="listing-owner-card__chips">
            {[0, 1, 2].map((i) => (
              <span key={i} className="sk-block sk-block--chip" />
            ))}
          </div>
          <span className="sk-line sk-line--full" />
          <span className="sk-line sk-line--full" />
        </div>
      </div>
    </div>
  );
}

export function ClientAnalyticsSkeleton() {
  return (
    <div className="page page--flush-top page-stack owner-analytics sk-content" aria-hidden>
      <div className="owner-analytics__hero">
        <span className="sk-line sk-line--eyebrow" />
        <span className="sk-line sk-line--dash-title" />
        <span className="sk-line sk-line--dash-sub" />
      </div>
      <div className="owner-analytics__toolbar sk-block" style={{ height: 72, borderRadius: 16 }} />
      <div className="stat-grid owner-analytics__stat-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="stat-card sk-stat-card">
            <span className="sk-line sk-line--label" />
            <span className="sk-line sk-line--value" />
          </div>
        ))}
      </div>
      <div className="owner-analytics__table-wrap">
        <span className="sk-line sk-line--full" style={{ margin: 16 }} />
        <span className="sk-line sk-line--full" style={{ margin: "0 16px 16px" }} />
      </div>
    </div>
  );
}

export function ClientUpgradeSkeleton() {
  return (
    <div className="page page--flush-top page-stack sk-content" aria-hidden>
      <div>
        <span className="sk-line sk-line--dash-title" />
        <span className="sk-line sk-line--dash-sub sk-line--long" />
      </div>
      <div className="card sk-form-card">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="sk-field">
            <span className="sk-line sk-line--label" />
            <span className="sk-block sk-block--input" />
          </div>
        ))}
        <span className="sk-block sk-block--btn-inline" style={{ marginTop: 8 }} />
      </div>
    </div>
  );
}

export function ClientEditorSkeleton() {
  return (
    <div className="page page--flush-top sk-content" aria-hidden>
      <div className="editor-head">
        <span className="sk-line sk-line--back" />
        <span className="sk-line sk-line--dash-title" style={{ marginTop: 10 }} />
      </div>
      <div className="editor-grid">
        {[0, 1].map((c) => (
          <div key={c} className="card editor-card">
            <span className="sk-line sk-line--h3" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="sk-field">
                <span className="sk-line sk-line--label" />
                <span className="sk-block sk-block--input" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClientSettingsSkeleton() {
  return (
    <div className="page page-stack sk-content" aria-hidden>
      <div>
        <span className="sk-line sk-line--dash-title" />
        <span className="sk-line sk-line--dash-sub" />
      </div>
      <div className="settings-grid">
        {[0, 1].map((i) => (
          <div key={i} className="settings-card sk-settings-card">
            <span className="sk-block sk-block--icon-sq" />
            <div>
              <span className="sk-line sk-line--h3" />
              <span className="sk-line sk-line--wide" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
