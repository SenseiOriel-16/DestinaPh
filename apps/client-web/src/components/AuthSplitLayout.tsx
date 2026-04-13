import type { ReactNode } from "react";
import authBg from "../../../Hibiscus-Camp.jpg";

export type AuthSplitVariant = "client" | "admin";

type Props = {
  children: ReactNode;
  variant: AuthSplitVariant;
  /** Wider inner column for long register forms */
  formScrollClassName?: string;
};

function brandIconSrc(): string {
  const base = import.meta.env.BASE_URL || "/";
  const n = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${n}/system-icon.png`;
}

export function AuthSplitLayout({ children, variant, formScrollClassName }: Props) {
  const isClient = variant === "client";
  return (
    <div className="auth-split">
      <aside className="auth-split__hero" aria-label={isClient ? "DestinaPH business portal" : "DestinaPH admin"}>
        <img className="auth-split__hero-img" src={authBg} alt="" decoding="async" />
        <div className="auth-split__hero-overlay" aria-hidden />
        <div className="auth-split__hero-inner">
          <img src={brandIconSrc()} alt="" width={48} height={48} className="auth-split__brand-icon" />
          {isClient ? (
            <>
              <p className="auth-split__eyebrow">Business owner portal</p>
              <h1 className="auth-split__title">DestinaPH Business</h1>
              <p className="auth-split__lead">
                The DestinaPH client console is your home for listings and growth: publish destinations, refresh photos
                and details, and see how travelers engage — built for partners across Camarines Sur and beyond.
              </p>
              <ul className="auth-split__bullets">
                <li>Manage one or many business listings from a single account</li>
                <li>Track views and interest with built-in analytics</li>
                <li>Upgrade to premium when you&apos;re ready for more tools</li>
              </ul>
            </>
          ) : (
            <>
              <p className="auth-split__eyebrow">Platform administration</p>
              <h1 className="auth-split__title">DestinaPH Admin</h1>
              <p className="auth-split__lead">
                Keep the marketplace trusted: approve business owners, curate categories and geography, and spotlight
                quality listings for travelers.
              </p>
              <ul className="auth-split__bullets">
                <li>Owner approvals, suspensions, and safety</li>
                <li>Categories, municipalities, and featured content</li>
                <li>Premium payments and subscription oversight</li>
              </ul>
            </>
          )}
        </div>
      </aside>
      <div className="auth-split__form">
        <div className={["auth-split__form-inner", formScrollClassName].filter(Boolean).join(" ")}>{children}</div>
      </div>
    </div>
  );
}
