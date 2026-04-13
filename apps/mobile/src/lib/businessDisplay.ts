import { supabase } from "./supabase";

export type AddressParts = {
  address_line?: string | null;
  barangays?: { name: string } | null;
  municipalities?: { name: string } | null;
  provinces?: { name: string } | null;
};

/** Full street + barangay + municipality + province for display. */
export function formatBusinessAddress(parts: AddressParts): string {
  const segs = [
    parts.address_line?.trim(),
    parts.barangays?.name,
    parts.municipalities?.name,
    parts.provinces?.name,
  ].filter(Boolean) as string[];
  if (segs.length) return segs.join(", ");
  return parts.municipalities?.name ?? parts.provinces?.name ?? "Philippines";
}

type PhotoRow = { storage_path: string; sort_order?: number | null };

export function sortedPhotoPublicUrls(photos: PhotoRow[] | null | undefined): string[] {
  if (!photos?.length) return [];
  return [...photos]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((p) => supabase.storage.from("business-images").getPublicUrl(p.storage_path).data.publicUrl);
}

export function firstPhotoPublicUrl(photos: PhotoRow[] | null | undefined): string | null {
  const urls = sortedPhotoPublicUrls(photos);
  return urls[0] ?? null;
}
