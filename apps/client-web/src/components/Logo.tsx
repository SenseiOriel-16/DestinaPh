function systemIconHref(): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalized}/system-icon.png`;
}

/** System brand mark from `public/system-icon.png` (synced from `apps/System_Icon.png`). */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <img
      src={systemIconHref()}
      width={size}
      height={size}
      alt="DestinaPH"
      style={{ borderRadius: 12, objectFit: "contain", display: "block" }}
    />
  );
}
