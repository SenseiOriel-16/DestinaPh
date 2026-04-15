/**
 * Philippine Standard Geographic Code (PSGC) — public mirror API.
 * @see https://psgc.gitlab.io/
 */

const PSGC_BASE = "https://psgc.gitlab.io/api";

/**
 * API responses may expose `code` as a JSON number, which drops leading zeros (e.g. 012801000 → 12801000)
 * and breaks URLs / strict equality with `psgc-…` slugs. Normalize digit-only codes to 9 digits.
 */
export function normalizePsgcCode(raw: string | number | null | undefined): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return s;
  if (s.length < 9) return s.padStart(9, "0");
  return s;
}

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

/** Sub-resources expect a trailing slash; missing slash can yield an HTML redirect body instead of JSON. */
async function getJsonIfOk<T>(path: string): Promise<T | null> {
  const url = `${PSGC_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`PSGC ${res.status}: ${res.statusText}`);
  }
  return (await res.json()) as T;
}

type PsgcBarangayApiRow = {
  code: string;
  name: string;
  provinceCode: string;
  municipalityCode?: string | false;
  cityCode?: string | false;
};

function normalizeBarangayRows(rows: PsgcBarangayApiRow[], placeCode: string): PsgcBarangay[] {
  const placeNorm = normalizePsgcCode(placeCode);
  return rows.map((r) => {
    const parentCode =
      typeof r.municipalityCode === "string"
        ? normalizePsgcCode(r.municipalityCode)
        : typeof r.cityCode === "string"
          ? normalizePsgcCode(r.cityCode)
          : placeNorm;
    return {
      code: normalizePsgcCode(r.code),
      name: r.name,
      municipalityCode: parentCode,
      provinceCode: normalizePsgcCode(r.provinceCode),
    };
  });
}

export async function fetchProvinces(): Promise<PsgcProvince[]> {
  const rows = await getJson<PsgcProvince[]>("/provinces/");
  return [...rows]
    .map((r) => ({ ...r, code: normalizePsgcCode(r.code) }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

export async function fetchCitiesAndMunicipalities(provinceCode: string): Promise<PsgcCityMunicipality[]> {
  const code = encodeURIComponent(normalizePsgcCode(provinceCode));
  const rows = await getJson<PsgcCityMunicipality[]>(`/provinces/${code}/cities-municipalities/`);
  return [...rows]
    .map((r) => ({
      ...r,
      code: normalizePsgcCode(r.code),
      provinceCode: normalizePsgcCode(r.provinceCode),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

/**
 * Barangays for a PSGC city are under `/cities/.../barangays/`; for a municipality under `/municipalities/.../barangays/`.
 * The combined province list marks each place with isCity / isMunicipality — we try both paths so callers only pass the code.
 */
export async function fetchBarangays(placeCode: string): Promise<PsgcBarangay[]> {
  const code = encodeURIComponent(normalizePsgcCode(placeCode));
  const placeNorm = normalizePsgcCode(placeCode);

  // Single endpoint for both cities and municipalities (avoids a 404 on `/municipalities/...` for cities).
  const unified = await getJsonIfOk<PsgcBarangayApiRow[]>(`/cities-municipalities/${code}/barangays/`);
  if (unified) {
    return [...normalizeBarangayRows(unified, placeNorm)].sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    );
  }

  const paths = [`/municipalities/${code}/barangays/`, `/cities/${code}/barangays/`] as const;
  for (const path of paths) {
    const rows = await getJsonIfOk<PsgcBarangayApiRow[]>(path);
    if (rows?.length) {
      return [...normalizeBarangayRows(rows, placeNorm)].sort((a, b) =>
        a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
      );
    }
  }
  throw new Error(`PSGC: no barangays for code ${placeNorm}`);
}
