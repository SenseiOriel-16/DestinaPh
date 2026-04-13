import { supabase } from "./supabase";

/** Maps, itinerary, reserve, etc. — stored as intent_visit for admin analytics. */
export function trackListingIntentVisit(businessId: string): void {
  void supabase.rpc("track_business_metric", { target: businessId, metric: "click" });
}
