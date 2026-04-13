import { useState } from "react";

function landingImageSrc(): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalized}/Client_Landing_Page.png`;
}

/**
 * Left column for login / register — full hero art from `public/Client_Landing_Page.png`.
 * Place your exported mock there (exact filename). If missing, a teal gradient fallback shows.
 */
export function AuthVisual() {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);

  return (
    <div
      className={`auth-split__visual${heroFailed ? " auth-split__visual--fallback" : ""}`}
      aria-label="DestinaPH — Discover destinations. Plan smarter. Join the platform to grow your business."
    >
      {!heroFailed && (
        <img
          className={`auth-split__hero-img${heroLoaded ? " is-loaded" : ""}`}
          src={landingImageSrc()}
          alt=""
          decoding="async"
          onLoad={() => setHeroLoaded(true)}
          onError={() => setHeroFailed(true)}
        />
      )}
      <span className="visually-hidden">
        DestinaPH. Discover destinations. Plan smarter. Manage your business, track performance, reach more
        customers — secure and reliable.
      </span>
    </div>
  );
}
