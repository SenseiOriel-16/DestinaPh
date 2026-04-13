export type LatLng = { latitude: number; longitude: number };

/** Earth mean radius in km */
const R = 6371;

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

/** Great-circle distance in kilometers */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

/** Human-readable distance (e.g. "850 m away", "2.3 km away") */
export function formatDistanceAway(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 1) {
    const m = Math.round(km * 1000);
    return `${m} m away`;
  }
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}
