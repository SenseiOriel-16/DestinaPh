/**
 * Philippine Standard Geographic Code (PSGC) — public mirror API.
 * @see https://psgc.gitlab.io/
 */

const PSGC_BASE = "https://psgc.gitlab.io/api";

export type PsgcProvince = { code: string; name: string; regionCode: string; islandGroupCode: string };

export type PsgcCityMunicipality = {
  code: string;
  name: string;
  provinceCode: string;
  isCity: boolean;
  isMunicipality: boolean;
};

export type PsgcBarangay = {
  code: string;
  name: string;
  municipalityCode: string;
  provinceCode: string;
};

async function getJson<T>(path: string): Promise<T> {
  const url = `${PSGC_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`PSGC ${res.status}: ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function fetchProvinces(): Promise<PsgcProvince[]> {
  const rows = await getJson<PsgcProvince[]>("/provinces/");
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

export async function fetchCitiesAndMunicipalities(provinceCode: string): Promise<PsgcCityMunicipality[]> {
  const code = encodeURIComponent(provinceCode);
  const rows = await getJson<PsgcCityMunicipality[]>(`/provinces/${code}/cities-municipalities`);
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

export async function fetchBarangays(municipalityCode: string): Promise<PsgcBarangay[]> {
  const code = encodeURIComponent(municipalityCode);
  const rows = await getJson<PsgcBarangay[]>(`/municipalities/${code}/barangays`);
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}
