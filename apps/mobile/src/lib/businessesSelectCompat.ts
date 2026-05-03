import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

/**
 * Hosted DBs lagging migrations return 400 when `select=` references unknown columns.
 * Detect that so we can retry without newer fields (promo, closed_reason).
 */
export function isBusinessesUnknownColumnOrRelationError(error: PostgrestError | null): boolean {
  if (!error) return false;
  const msg = `${error.message ?? ""}\n${(error as { details?: string }).details ?? ""}`.toLowerCase();
  return (
    /column\s+[\w."']*\s+does\s+not\s+exist/i.test(msg) ||
    msg.includes("could not find") ||
    (msg.includes("column") && msg.includes("not exist"))
  );
}

/** Full detail fetch — requires promo + closed_reason migrations. */
export const BUSINESS_DETAIL_SELECT_FULL = `
          name,
          description,
          short_description,
          subcategory,
          allow_reservations,
          address_line,
          latitude,
          longitude,
          closed_now,
          fully_booked,
          closed_reason,
          owner_id,
          rating_average,
          rating_count,
          tags,
          accommodations,
          entrance_fee_pesos,
          entrance_fee_day_pesos,
          entrance_fee_night_pesos,
          operating_day,
          operating_night,
          operating_hours_always_open,
          operating_open_hour,
          operating_open_meridiem,
          operating_close_hour,
          operating_close_meridiem,
          advisory_text,
          operating_variations_text,
          promo_headline,
          promo_body,
          promo_valid_until,
          pricing_text,
          estimated_cost_min_pesos,
          estimated_cost_max_pesos,
          best_visit_times,
          municipalities(name),
          provinces(name),
          barangays(name),
          categories(name),
          business_photos(storage_path,sort_order)
        `;

/** Same as FULL but omits promo + closed_reason (older remote DB). */
export const BUSINESS_DETAIL_SELECT_LEGACY = `
          name,
          description,
          short_description,
          subcategory,
          allow_reservations,
          address_line,
          latitude,
          longitude,
          closed_now,
          fully_booked,
          owner_id,
          rating_average,
          rating_count,
          tags,
          accommodations,
          entrance_fee_pesos,
          entrance_fee_day_pesos,
          entrance_fee_night_pesos,
          operating_day,
          operating_night,
          operating_hours_always_open,
          operating_open_hour,
          operating_open_meridiem,
          operating_close_hour,
          operating_close_meridiem,
          advisory_text,
          operating_variations_text,
          pricing_text,
          estimated_cost_min_pesos,
          estimated_cost_max_pesos,
          best_visit_times,
          municipalities(name),
          provinces(name),
          barangays(name),
          categories(name),
          business_photos(storage_path,sort_order)
        `;

export async function fetchBusinessDetailRow(supabase: SupabaseClient, listingId: string) {
  let { data, error } = await supabase
    .from("businesses")
    .select(BUSINESS_DETAIL_SELECT_FULL.trim())
    .eq("id", listingId)
    .order("sort_order", { ascending: true, foreignTable: "business_photos" })
    .maybeSingle();
  if (error && isBusinessesUnknownColumnOrRelationError(error)) {
    // eslint-disable-next-line no-console
    console.warn(
      "[DestinaPH] Listing query failed (likely missing promo/closed_reason columns). Retrying legacy select. Apply Supabase migrations: 20260503120000_business_promo_fields.sql · 20260503193000_closed_reason.sql\n",
      error.message,
    );
    const second = await supabase
      .from("businesses")
      .select(BUSINESS_DETAIL_SELECT_LEGACY.trim())
      .eq("id", listingId)
      .order("sort_order", { ascending: true, foreignTable: "business_photos" })
      .maybeSingle();
    data = second.data;
    error = second.error;
    return { data, error, usedLegacyColumns: true as const };
  }
  return { data, error, usedLegacyColumns: false as const };
}

/** Explore / Home listing column sets */
export const BUSINESS_LIST_SELECT_FULL =
  "id,name,description,promo_headline,promo_body,promo_valid_until,subcategory,tags,status,address_line,rating_average,rating_count,estimated_cost_min_pesos,estimated_cost_max_pesos,best_visit_times,categories(slug,name),municipalities(id,name),provinces(name),barangays(name),business_photos(storage_path,sort_order)";

export const BUSINESS_LIST_SELECT_LEGACY =
  "id,name,description,subcategory,tags,status,address_line,rating_average,rating_count,estimated_cost_min_pesos,estimated_cost_max_pesos,best_visit_times,categories(slug,name),municipalities(id,name),provinces(name),barangays(name),business_photos(storage_path,sort_order)";

export const BUSINESS_HOME_NEAR_SELECT_FULL =
  "id,name,description,promo_headline,promo_body,promo_valid_until,address_line,latitude,longitude,rating_average,rating_count,estimated_cost_min_pesos,estimated_cost_max_pesos,best_visit_times,categories(slug,name),municipalities(name),provinces(name),barangays(name),business_photos(storage_path,sort_order)";

export const BUSINESS_HOME_NEAR_SELECT_LEGACY =
  "id,name,description,address_line,latitude,longitude,rating_average,rating_count,estimated_cost_min_pesos,estimated_cost_max_pesos,best_visit_times,categories(slug,name),municipalities(name),provinces(name),barangays(name),business_photos(storage_path,sort_order)";

/** user_favorites embed body — FULL includes promo Body for teaser. */
export const FAVORITES_BUSINESSES_EMBED_FULL = `
        id,
        created_at,
        businesses (
          id,
          name,
          status,
          short_description,
          promo_headline,
          promo_body,
          promo_valid_until,
          address_line,
          municipalities (name),
          provinces (name),
          barangays (name),
          business_photos (storage_path, sort_order)
        )
      `;

export const FAVORITES_BUSINESSES_EMBED_LEGACY = `
        id,
        created_at,
        businesses (
          id,
          name,
          status,
          short_description,
          address_line,
          municipalities (name),
          provinces (name),
          barangays (name),
          business_photos (storage_path, sort_order)
        )
      `;

export async function fetchUserFavoritesWithBusinesses(supabase: SupabaseClient, userId: string) {
  let { data, error } = await supabase
    .from("user_favorites")
    .select(FAVORITES_BUSINESSES_EMBED_FULL.trim())
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error && isBusinessesUnknownColumnOrRelationError(error)) {
    // eslint-disable-next-line no-console
    console.warn("[DestinaPH] Favorites query retry (legacy).", error.message);
    const second = await supabase
      .from("user_favorites")
      .select(FAVORITES_BUSINESSES_EMBED_LEGACY.trim())
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    data = second.data;
    error = second.error;
  }
  return { data, error };
}

export async function fetchApprovedBusinessRowsList(
  supabase: SupabaseClient,
  selectFull: string,
  selectLegacy: string,
): Promise<{ data: unknown; error: PostgrestError | null }> {
  let { data, error } = await supabase
    .from("businesses")
    .select(selectFull)
    .eq("status", "approved")
    .order("sort_order", { ascending: true, foreignTable: "business_photos" });
  if (error && isBusinessesUnknownColumnOrRelationError(error)) {
    // eslint-disable-next-line no-console
    console.warn(
      "[DestinaPH] List query retry (legacy columns). Apply promo migration if missing.\n",
      error.message,
    );
    const second = await supabase
      .from("businesses")
      .select(selectLegacy)
      .eq("status", "approved")
      .order("sort_order", { ascending: true, foreignTable: "business_photos" });
    return { data: second.data, error: second.error };
  }
  return { data, error };
}
