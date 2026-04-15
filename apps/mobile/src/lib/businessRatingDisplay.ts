export type RatingParts =
  | { kind: "new" }
  | {
      kind: "rated";
      averageText: string;
      countText: string;
      count: number;
      average: number;
    };

export function ratingParts(average: number | null | undefined, count: number | null | undefined): RatingParts {
  const c = Math.max(0, Math.floor(Number(count ?? 0) || 0));
  const a = average == null ? NaN : Number(average);
  if (c <= 0 || !Number.isFinite(a)) return { kind: "new" };
  return {
    kind: "rated",
    average: a,
    count: c,
    averageText: a.toFixed(1),
    countText: String(c),
  };
}

/** Display text for listing cards / detail header (fallback when you can't style parts). */
export function formatRatingPill(average: number | null | undefined, count: number | null | undefined): string {
  const p = ratingParts(average, count);
  if (p.kind === "new") return "New";
  return `${p.averageText} ★ ${p.countText}`;
}

/** Secondary line e.g. "4.9 · 12 ratings" */
export function formatRatingSubtitle(average: number | null | undefined, count: number | null | undefined): string {
  const c = count ?? 0;
  if (c <= 0 || average == null) return "No ratings yet";
  const n = Number(average);
  return `${n.toFixed(1)} · ${c} rating${c === 1 ? "" : "s"}`;
}
