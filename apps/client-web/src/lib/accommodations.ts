export type AccommodationItem = {
  name: string;
  pax: string;
  price_pesos: number;
  /** When false, the owner marks this unit type as unavailable for guests. */
  available: boolean;
};

/** Normalize stored JSONB accommodations for display / updates (drops unnamed rows). */
export function normalizeSavedAccommodations(raw: unknown): AccommodationItem[] {
  if (!Array.isArray(raw)) return [];
  const out: AccommodationItem[] = [];
  for (const item of raw) {
    const o = item as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    if (!name) continue;
    out.push({
      name,
      pax: String(o.pax ?? o.pax_label ?? ""),
      price_pesos: Math.max(0, Math.round(Number(o.price_pesos) || 0)),
      available: o.available !== false,
    });
  }
  return out;
}
