export type PriorityKey = "distance" | "budget" | "popularity";

export type ResortPeriod = "day" | "night";
export type FoodVisitTime = "Breakfast" | "Lunch" | "Dinner";

export type GeneratePrefs = {
  origin: { latitude: number; longitude: number };
  municipalityId: string;
  categorySlug: string;
  resortPeriod: ResortPeriod;
  entranceBudget: number | null;
  groupSize: number | null;
  foodVisitTime: FoodVisitTime | null;
  foodBudgetPerPerson: number | null;
  priorities: [PriorityKey, PriorityKey, PriorityKey];
};

export type BizCandidate = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  categorySlug: string;
  categoryName: string | null;
  municipalityId: string | null;
  municipalityName: string | null;
  ratingAverage: number | null;
  ratingCount: number | null;
  allowReservations: boolean;
  operatingDay: boolean;
  operatingNight: boolean;
  entranceFeeDefault: number | null;
  entranceFeeDay: number | null;
  entranceFeeNight: number | null;
  accommodations: { pax?: string | null; available?: boolean | null; price_pesos?: number | null }[] | null;
  estimatedCostMin: number | null;
  estimatedCostMax: number | null;
  bestVisitTimes: string[] | null;
  photoUrl: string | null;
};

export type AccommodationPick = {
  name: string;
  pax: string | null;
  pricePesos: number;
};

export type RankedCandidate = BizCandidate & {
  distKm: number;
  budgetValue: number; // smaller is better
  popularityValue: number; // larger is better
  entranceFeePesos: number | null;
  accommodationCheapestPesos: number | null;
  accommodationPick: AccommodationPick | null;
  estimatedTotalPesos: number | null;
  estimatedTotalPerPersonPesos: number | null;
};

const R = 6371;
function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function parsePaxRange(paxRaw: string): { min: number; max: number } | null {
  const s = paxRaw.toLowerCase().replace(/pax/g, "").trim();
  if (!s) return null;
  const range = s.match(/(\d{1,3})\s*-\s*(\d{1,3})/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const single = s.match(/(\d{1,3})/);
  if (single) {
    const n = Number(single[1]);
    if (Number.isFinite(n) && n > 0) return { min: n, max: n };
  }
  return null;
}

function accommodationFits(list: BizCandidate["accommodations"], groupSize: number) {
  if (!list?.length) return false;
  for (const a of list) {
    if (a?.available === false) continue;
    const r = a?.pax ? parsePaxRange(String(a.pax)) : null;
    if (!r) continue;
    if (groupSize >= r.min && groupSize <= r.max) return true;
  }
  return false;
}

function cheapestAccommodationPrice(list: BizCandidate["accommodations"], groupSize: number): number | null {
  if (!list?.length) return null;
  let best: number | null = null;
  for (const a of list) {
    if (a?.available === false) continue;
    const r = a?.pax ? parsePaxRange(String(a.pax)) : null;
    if (!r) continue;
    if (groupSize < r.min || groupSize > r.max) continue;
    const price = typeof a.price_pesos === "number" && Number.isFinite(a.price_pesos) ? Math.max(0, Math.round(a.price_pesos)) : null;
    if (price == null) continue;
    if (best == null || price < best) best = price;
  }
  return best;
}

function cheapestAccommodationPick(list: BizCandidate["accommodations"], groupSize: number): AccommodationPick | null {
  if (!list?.length) return null;
  let best: AccommodationPick | null = null;
  for (const a of list) {
    if (a?.available === false) continue;
    const r = a?.pax ? parsePaxRange(String(a.pax)) : null;
    if (!r) continue;
    if (groupSize < r.min || groupSize > r.max) continue;
    const price =
      typeof a.price_pesos === "number" && Number.isFinite(a.price_pesos) ? Math.max(0, Math.round(a.price_pesos)) : null;
    if (price == null) continue;
    const name = String((a as any).name ?? "").trim();
    if (!name) continue;
    const pax = a?.pax != null ? String(a.pax) : null;
    if (!best || price < best.pricePesos) best = { name, pax, pricePesos: price };
  }
  return best;
}

function entranceFeeForPeriod(b: BizCandidate, period: ResortPeriod): number | null {
  const fee = period === "day" ? b.entranceFeeDay : b.entranceFeeNight;
  if (typeof fee === "number" && Number.isFinite(fee) && fee >= 0) return fee;
  if (typeof b.entranceFeeDefault === "number" && Number.isFinite(b.entranceFeeDefault) && b.entranceFeeDefault >= 0) return b.entranceFeeDefault;
  return null;
}

function periodAvailable(b: BizCandidate, period: ResortPeriod) {
  return period === "day" ? b.operatingDay : b.operatingNight;
}

function normRating(avg: number | null): number {
  const x = typeof avg === "number" && Number.isFinite(avg) ? avg : 0;
  return Math.max(0, Math.min(5, x));
}

function normCount(cnt: number | null): number {
  const x = typeof cnt === "number" && Number.isFinite(cnt) ? cnt : 0;
  return Math.max(0, Math.floor(x));
}

function makeRanked(prefs: GeneratePrefs, b: BizCandidate): RankedCandidate | null {
  if (!b.allowReservations) return null;
  if (!b.latitude || !b.longitude) return null;
  if (!b.municipalityId || b.municipalityId !== prefs.municipalityId) return null;
  if (!b.categorySlug || b.categorySlug !== prefs.categorySlug) return null;

  const distKm = haversineKm(prefs.origin, { latitude: b.latitude, longitude: b.longitude });

  // Budget value: for resorts we use entrance fee for selected period. If missing, treat as large.
  let budgetValue = 1e9;
  let entranceFeePesos: number | null = null;
  let accommodationCheapestPesos: number | null = null;
  let accommodationPick: AccommodationPick | null = null;
  let estimatedTotalPesos: number | null = null;
  let estimatedTotalPerPersonPesos: number | null = null;
  if (prefs.categorySlug === "resorts-leisure") {
    if (!periodAvailable(b, prefs.resortPeriod)) return null;
    const fee = entranceFeeForPeriod(b, prefs.resortPeriod);
    entranceFeePesos = fee;
    if (prefs.entranceBudget != null) {
      if (fee == null) return null;
      if (fee > prefs.entranceBudget) return null;
    }
    if (fee != null) budgetValue = fee;
    if (prefs.groupSize != null) {
      if (!accommodationFits(b.accommodations, prefs.groupSize)) return null;
      accommodationCheapestPesos = cheapestAccommodationPrice(b.accommodations, prefs.groupSize);
      accommodationPick = cheapestAccommodationPick(b.accommodations, prefs.groupSize);
    }
    if (fee != null) {
      const n = prefs.groupSize != null ? Math.max(1, Math.floor(prefs.groupSize)) : 1;
      const entranceTotal = fee * n;
      estimatedTotalPesos = entranceTotal + (accommodationPick?.pricePesos ?? accommodationCheapestPesos ?? 0);
    }
  }

  if (prefs.categorySlug === "food-dining") {
    const when = prefs.foodVisitTime;
    if (when) {
      const bt = b.bestVisitTimes ?? [];
      if (!bt.includes(when)) return null;
    }
    const target = prefs.foodBudgetPerPerson;
    if (target != null) {
      const min = b.estimatedCostMin;
      const max = b.estimatedCostMax;
      if (typeof min !== "number" || typeof max !== "number") return null;
      if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
      if (target < min || target > max) return null;
      // Budget metric for ranking: closer midpoint to target wins (then narrower range).
      const mid = (min + max) / 2;
      const width = Math.max(0, max - min);
      budgetValue = Math.abs(mid - target) + width * 0.01;
      estimatedTotalPerPersonPesos = target;
      if (prefs.groupSize != null) {
        const n = Math.max(1, Math.floor(prefs.groupSize));
        estimatedTotalPesos = target * n;
      }
    }
  }

  // Default: if other categories have an entrance fee, show a simple estimate.
  if (prefs.categorySlug !== "resorts-leisure" && prefs.categorySlug !== "food-dining") {
    const fee = entranceFeeForPeriod(b, prefs.resortPeriod);
    entranceFeePesos = fee;
    if (fee != null) budgetValue = fee;
    if (fee != null) {
      const n = prefs.groupSize != null ? Math.max(1, Math.floor(prefs.groupSize)) : 1;
      estimatedTotalPesos = fee * n;
    }
  }

  // Popularity: rating first, then count.
  const popularityValue = normRating(b.ratingAverage) * 1000 + Math.min(999, normCount(b.ratingCount));

  return {
    ...b,
    distKm,
    budgetValue,
    popularityValue,
    entranceFeePesos,
    accommodationCheapestPesos,
    accommodationPick,
    estimatedTotalPesos,
    estimatedTotalPerPersonPesos,
  };
}

function cmpNumAsc(a: number, b: number, eps = 0) {
  if (Math.abs(a - b) <= eps) return 0;
  return a < b ? -1 : 1;
}

function cmpNumDesc(a: number, b: number, eps = 0) {
  if (Math.abs(a - b) <= eps) return 0;
  return a > b ? -1 : 1;
}

function metricCompare(key: PriorityKey, a: RankedCandidate, b: RankedCandidate) {
  if (key === "distance") return cmpNumAsc(a.distKm, b.distKm, 0.02); // treat 20m as tie
  if (key === "budget") return cmpNumAsc(a.budgetValue, b.budgetValue, 0); // pesos exact
  return cmpNumDesc(a.popularityValue, b.popularityValue, 0); // popularity exact
}

export function rankCandidates(list: BizCandidate[], prefs: GeneratePrefs): RankedCandidate[] {
  const ranked: RankedCandidate[] = [];
  for (const b of list) {
    const r = makeRanked(prefs, b);
    if (r) ranked.push(r);
  }

  const [p1, p2, p3] = prefs.priorities;
  ranked.sort((a, b) => {
    const c1 = metricCompare(p1, a, b);
    if (c1 !== 0) return c1;
    const c2 = metricCompare(p2, a, b);
    if (c2 !== 0) return c2;
    const c3 = metricCompare(p3, a, b);
    if (c3 !== 0) return c3;
    // Stable-ish fallback.
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return ranked;
}

