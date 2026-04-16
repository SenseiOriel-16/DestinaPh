import { supabase } from "./supabase";

/** Fallback analytics-only intent visit (no geo confirmation). */
export function trackListingIntentVisit(businessId: string): void {
  void supabase.rpc("track_business_metric", { target: businessId, metric: "click" });
}
