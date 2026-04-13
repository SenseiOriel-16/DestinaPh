function systemIconSrc(): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalized}/system-icon.png`;
}

/** Left panel illustration — minimalist landscape (mock-inspired) */
export function AuthVisual() {
  return (
    <div className="auth-split__visual">
      <div className="auth-split__mountain" aria-hidden>
        <svg viewBox="0 0 320 200" width="100%" height="100%" style={{ display: "block" }}>
          <defs>
            <linearGradient id="m1" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#063d4a" />
              <stop offset="100%" stopColor="#0a8a7d" />
            </linearGradient>
            <linearGradient id="sun" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffd54a" />
              <stop offset="100%" stopColor="#ffb703" />
            </linearGradient>
          </defs>
          <circle cx="260" cy="48" r="28" fill="url(#sun)" opacity="0.95" />
          <path d="M0 200 L0 120 L55 75 L110 105 L165 55 L230 95 L280 70 L320 110 L320 200 Z" fill="url(#m1)" opacity="0.55" />
          <path d="M0 200 L0 145 L80 100 L140 130 L200 88 L260 115 L320 95 L320 200 Z" fill="#0b5f56" opacity="0.9" />
          <path d="M0 200 L0 165 L95 125 L160 150 L220 118 L290 138 L320 128 L320 200 Z" fill="#0d7a70" />
          <rect x="118" y="118" width="44" height="36" rx="4" fill="#e8dcc8" opacity="0.9" />
          <polygon points="118,118 140,95 162,118" fill="#c49a6c" />
          <path
            d="M40 200 Q160 175 280 200"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div style={{ position: "relative", zIndex: 1, marginBottom: 12 }}>
        <img
          src={systemIconSrc()}
          width={56}
          height={56}
          alt="DestinaPH"
          style={{ borderRadius: 14, objectFit: "contain", display: "block" }}
          decoding="async"
        />
      </div>
      <p className="auth-split__tagline">Discover Destinations. Plan Smarter.</p>
    </div>
  );
}
