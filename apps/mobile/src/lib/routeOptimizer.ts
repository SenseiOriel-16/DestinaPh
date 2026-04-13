export type RoutePoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function buildDistanceMatrix(points: RoutePoint[]): number[][] {
  const n = points.length;
  const m: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) m[i][j] = haversineKm(points[i], points[j]);
    }
  }
  return m;
}

const INF = 1e18;

export function optimizeRouteOrder(points: RoutePoint[]): {
  ordered: RoutePoint[];
  totalDistanceKm: number;
  estimatedMinutes: number;
} {
  if (points.length === 0) {
    return { ordered: [], totalDistanceKm: 0, estimatedMinutes: 0 };
  }
  if (points.length === 1) {
    return { ordered: [...points], totalDistanceKm: 0, estimatedMinutes: 0 };
  }

  const n = points.length;
  const dist = buildDistanceMatrix(points);
  const full = (1 << n) - 1;
  const startBit = 1;

  const dp = new Map<string, number>();
  const parent = new Map<string, number>();
  const key = (mask: number, j: number) => `${mask},${j}`;

  dp.set(key(startBit, 0), 0);

  for (let mask = 1; mask <= full; mask++) {
    if ((mask & startBit) === 0) continue;
    for (let j = 0; j < n; j++) {
      if ((mask & (1 << j)) === 0) continue;
      const k0 = key(mask, j);
      const base = dp.get(k0);
      if (base === undefined) continue;
      for (let k = 0; k < n; k++) {
        if (mask & (1 << k)) continue;
        const nmask = mask | (1 << k);
        const nk = key(nmask, k);
        const cand = base + dist[j][k];
        const prev = dp.get(nk);
        if (prev === undefined || cand < prev) {
          dp.set(nk, cand);
          parent.set(nk, j);
        }
      }
    }
  }

  let bestEnd = 0;
  let bestCost = INF;
  for (let j = 0; j < n; j++) {
    const nk = key(full, j);
    const c = dp.get(nk);
    if (c !== undefined && c < bestCost) {
      bestCost = c;
      bestEnd = j;
    }
  }

  if (bestCost >= INF) {
    return { ordered: [...points], totalDistanceKm: 0, estimatedMinutes: 0 };
  }

  const orderIdxRev: number[] = [];
  let mask = full;
  let cur = bestEnd;
  while (true) {
    orderIdxRev.push(cur);
    const nk = key(mask, cur);
    const prv = parent.get(nk);
    if (prv === undefined) break;
    mask ^= 1 << cur;
    cur = prv;
  }
  const orderIdx = orderIdxRev.reverse();
  const ordered = orderIdx.map((i) => points[i]);
  const totalDistanceKm = bestCost;
  const estimatedMinutes = Math.round(totalDistanceKm * 12);
  return { ordered, totalDistanceKm, estimatedMinutes };
}
