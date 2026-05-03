/** PH calendar for tourism promos ("valid until" is understood in PH local date). */
const PH_TIMEZONE = "Asia/Manila";

/** Normalize headline from PostgREST / JSON (handles non-string edge cases). */
export function travelerPromoHeadlineText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = typeof v === "string" ? v : String(v);
  const t = s.trim();
  return t.length ? t : null;
}

/** Normalize date column to YYYY-MM-DD (handles full ISO timestamps). */
export function travelerPromoValidUntilIso(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Today YYYY-MM-DD in Asia/Manila (numeric parts — avoids ambiguous locale strings on RN/Hermes). */
function phCalendarTodayYmd(): string | null {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: PH_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = dtf.formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    /* fall through */
  }
  return null;
}

function ymdToNum(ymd: string): number | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
}

/**
 * True if promo is still active on calendar day inclusive (computed in Manila).
 */
export function travelerPromoDateStillValid(validUntil: unknown): boolean {
  const u = travelerPromoValidUntilIso(validUntil);
  if (!u) return true;
  const endNum = ymdToNum(u);
  if (endNum == null) return true;
  const todayStr = phCalendarTodayYmd();
  if (todayStr) {
    const todayNum = ymdToNum(todayStr);
    if (todayNum != null) return todayNum <= endNum;
  }
  const parts = u.split("-").map(Number);
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (!y || !mo || !d) return true;
  const endLocal = new Date(y, mo - 1, d, 23, 59, 59, 999);
  return Date.now() <= endLocal.getTime();
}

/**
 * Owner-set promo visible to travelers when there is headline and/or detail text
 * (body alone still counts — e.g. legacy rows) and the optional end date has not passed in PH time.
 */
export function travelerPromoVisible(headline: unknown, validUntil: unknown, promoBody?: unknown): boolean {
  const h = travelerPromoHeadlineText(headline);
  const pb = travelerPromoBodyText(promoBody);
  if (!h && !pb) return false;
  return travelerPromoDateStillValid(validUntil);
}

export function formatPromoUntilLabel(isoDate: string): string {
  const u = isoDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(u)) return isoDate.trim();
  try {
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: PH_TIMEZONE,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(`${u}T12:00:00+08:00`));
  } catch {
    const parts = u.split("-").map(Number);
    const y = parts[0];
    const mo = parts[1];
    const d = parts[2];
    if (!y || !mo || !d) return u;
    return new Date(y, mo - 1, d).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
}

/** Optional details paragraph from API. */
export function travelerPromoBodyText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = typeof v === "string" ? v : String(v);
  const t = s.trim();
  return t.length ? t : null;
}

/** Primary line shown in Explore/Home/Favorites pills (headline preferred). */
export function travelerPromoListTeaser(headline: unknown, promoBody?: unknown): string {
  const h = travelerPromoHeadlineText(headline);
  if (h) return h;
  const b = travelerPromoBodyText(promoBody);
  if (!b) return "";
  const lines = b.split(/\r?\n/);
  const first = lines.find((ln) => ln.trim().length)?.trim();
  const pick = first ?? b.trim();
  return pick.length <= 140 ? pick : `${pick.slice(0, 137)}…`;
}
