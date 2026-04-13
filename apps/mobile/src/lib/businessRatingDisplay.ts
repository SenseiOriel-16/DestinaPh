/** Display text for listing cards / detail header (e.g. 4.9/5). */
export function formatRatingPill(average: number | null | undefined, count: number | null | undefined): string {
  const c = count ?? 0;
  if (c <= 0 || average == null || Number.isNaN(Number(average))) return "New";
  const n = Number(average);
  return `${n.toFixed(1)}/5`;
}

/** Secondary line e.g. "4.9 · 12 ratings" */
export function formatRatingSubtitle(average: number | null | undefined, count: number | null | undefined): string {
  const c = count ?? 0;
  if (c <= 0 || average == null) return "No ratings yet";
  const n = Number(average);
  return `${n.toFixed(1)} · ${c} rating${c === 1 ? "" : "s"}`;
}
