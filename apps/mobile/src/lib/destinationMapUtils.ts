export type LatLng = { latitude: number; longitude: number };

export async function fetchOsrmRoute(from: LatLng, to: LatLng): Promise<{
  coords: LatLng[];
  durationSec: number | null;
  distanceM: number | null;
}> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return { coords: [], durationSec: null, distanceM: null };
  const json = (await res.json()) as {
    routes?: { duration?: number; distance?: number; geometry?: { coordinates?: [number, number][] } }[];
  };
  const osrmRoute = json.routes?.[0];
  const coordinates = osrmRoute?.geometry?.coordinates;
  if (!coordinates?.length) return { coords: [], durationSec: null, distanceM: null };
  const coords = coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  return {
    coords,
    durationSec: osrmRoute?.duration ?? null,
    distanceM: osrmRoute?.distance ?? null,
  };
}

export function formatDuration(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return `${h} h ${rest} min`;
}

export function formatDistanceKm(meters: number | null): string {
  if (meters == null || !Number.isFinite(meters)) return "—";
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  return `${km.toFixed(1)} km`;
}
