import * as Location from "expo-location";
import type { LocationSubscription } from "expo-location";
import { supabase } from "./supabase";

type VisitSource = "navigate" | "google_maps" | "in_app_map";
type VisitMethod = "geo" | "food_order_geo";

type ActiveVisit = {
  businessId: string;
  intentId: string | null;
  categoryName: string | null;
  destLat: number;
  destLng: number;
  radiusM: number;
  requireFoodOrder: boolean;
  foodOrderPlaced: boolean;
  dwellMs: number;
  lastTickMs: number | null;
  lastInside: boolean;
  confirmed: boolean;
  method: VisitMethod;
};

const DWELL_TARGET_MS = 5 * 60_000;

let sub: LocationSubscription | null = null;
let active: ActiveVisit | null = null;

function radiusForCategoryMeters(categoryName: string | null): number {
  const c = (categoryName ?? "").toLowerCase();
  if (c.includes("resort")) return 100;
  if (c.includes("nature")) return 200;
  if (c.includes("food")) return 20;
  // Default fallback (treat like nature).
  return 200;
}

function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const R = 6371e3;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

async function ensureWatcher(): Promise<void> {
  if (sub) return;
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return;

  sub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 10_000,
      distanceInterval: 10,
    },
    (pos) => {
      const a = active;
      if (!a || a.confirmed) return;
      const now = Date.now();
      const inside =
        haversineMeters(
          { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
          { latitude: a.destLat, longitude: a.destLng },
        ) <= a.radiusM;

      const last = a.lastTickMs ?? now;
      const dt = Math.max(0, now - last);
      a.lastTickMs = now;

      if (inside) {
        // Only count dwell when (a) inside radius and (b) food rule satisfied if required.
        const okFood = !a.requireFoodOrder || a.foodOrderPlaced;
        if (okFood) a.dwellMs += dt;
      } else {
        // Reset dwell when user leaves the radius (must be continuous stay).
        if (a.lastInside) a.dwellMs = 0;
      }
      a.lastInside = inside;

      if (a.dwellMs >= DWELL_TARGET_MS && !a.confirmed) {
        a.confirmed = true;
        void supabase.rpc("record_confirmed_visit", {
          p_business_id: a.businessId,
          p_intent_id: a.intentId,
          p_method: a.method,
        });
      }
    },
  );
}

export async function recordVisitIntentAndStartConfirmation(args: {
  businessId: string;
  source: VisitSource;
  categoryName: string | null;
  destLat: number;
  destLng: number;
  requireFoodOrder?: boolean;
}): Promise<void> {
  const requireFoodOrder = Boolean(args.requireFoodOrder);
  const radiusM = radiusForCategoryMeters(args.categoryName);
  const method: VisitMethod = requireFoodOrder ? "food_order_geo" : "geo";

  // Set active first so the watcher can start accumulating immediately.
  active = {
    businessId: args.businessId,
    intentId: null,
    categoryName: args.categoryName,
    destLat: args.destLat,
    destLng: args.destLng,
    radiusM,
    requireFoodOrder,
    foodOrderPlaced: false,
    dwellMs: 0,
    lastTickMs: null,
    lastInside: false,
    confirmed: false,
    method,
  };

  await ensureWatcher();

  // Record intent (server will also append intent_visit analytics).
  try {
    const { data } = await supabase.rpc("record_visit_intent", {
      p_business_id: args.businessId,
      p_source: args.source,
    });
    if (active && active.businessId === args.businessId) {
      active.intentId = typeof data === "string" ? data : null;
    }
  } catch {
    // ignore: intent not critical for confirmation logic
  }
}

/** Call this when a Food & Dining "order" is placed. */
export function markFoodOrderPlaced(businessId: string): void {
  if (active?.businessId !== businessId) return;
  active.foodOrderPlaced = true;
}

export function stopVisitConfirmation(): void {
  active = null;
  sub?.remove();
  sub = null;
}

