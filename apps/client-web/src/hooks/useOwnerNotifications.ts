import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { playNotificationSound } from "../lib/notificationSound";

const CLEAR_BOOKING_NOTIFS_EVENT = "destinaph-owner-notifs-clear-bookings";
const RESERVATIONS_REFRESH_EVENT = "destinaph-owner-reservations-refresh";

export type OwnerNotifItem = {
  id: string;
  kind: "new_rating" | "rating_removed" | "new_booking";
  title: string;
  subtitle: string;
  href: string;
  createdAt: string;
};

export type OwnerToast = {
  id: string;
  title: string;
  body: string;
  href: string;
};

export function useOwnerNotifications() {
  const [items, setItems] = useState<OwnerNotifItem[]>([]);
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<OwnerToast[]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const seenRatingIds = useRef<Set<string>>(new Set());
  const seenBookingIds = useRef<Set<string>>(new Set());
  const businessIdsRef = useRef<string[]>([]);
  const businessNameRef = useRef<Map<string, string>>(new Map());
  const pollBusyRef = useRef(false);

  const pushToast = useCallback((t: Omit<OwnerToast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 7000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addRatingNotification = useCallback(
    (ratingId: string, businessId: string, stars: number, businessName: string, meta?: { kind?: "new" | "changed" }) => {
      const kind = meta?.kind ?? "new";
      const title = kind === "changed" ? "Rating updated" : "New traveler rating";
      const body =
        kind === "changed"
          ? `A traveler changed their rating to ${stars}★ for ${businessName}.`
          : `${businessName} received ${stars}★ from a traveler.`;
      playNotificationSound();
      if (typeof window !== "undefined" && "Notification" in window) {
        if (document.visibilityState !== "visible" && Notification.permission === "granted") {
          try {
            new Notification(title, {
              body,
            });
          } catch {
            // ignore
          }
        }
      }
      const now = new Date().toISOString();

      setItems((prev) =>
        [
          {
            id: `rating-${ratingId}`,
            kind: "new_rating",
            title,
            subtitle:
              kind === "changed"
                ? `${businessName}: changed to ${stars} star${stars === 1 ? "" : "s"}`
                : `${businessName}: ${stars} star${stars === 1 ? "" : "s"}`,
            href: `/listings/${businessId}`,
            createdAt: now,
          },
          ...prev,
        ].slice(0, 30),
      );

      pushToast({
        title,
        body,
        href: `/listings/${businessId}`,
      });
    },
    [pushToast],
  );

  const addRatingRemovedNotification = useCallback(
    (ratingId: string, businessId: string, businessName: string) => {
      playNotificationSound();
      if (typeof window !== "undefined" && "Notification" in window) {
        if (document.visibilityState !== "visible" && Notification.permission === "granted") {
          try {
            new Notification("Rating removed", {
              body: `${businessName}: a traveler removed their rating.`,
            });
          } catch {
            // ignore
          }
        }
      }
      const now = new Date().toISOString();

      setItems((prev) =>
        [
          {
            id: `rating-removed-${ratingId}`,
            kind: "rating_removed",
            title: "Rating removed",
            subtitle: `${businessName}: a traveler removed their rating`,
            href: `/listings/${businessId}`,
            createdAt: now,
          },
          ...prev,
        ].slice(0, 30),
      );

      pushToast({
        title: "Rating removed",
        body: `${businessName}: a traveler removed their rating.`,
        href: `/listings/${businessId}`,
      });
    },
    [pushToast],
  );

  const addBookingNotification = useCallback(
    (bookingId: string, businessName: string) => {
      playNotificationSound();
      if (typeof window !== "undefined" && "Notification" in window) {
        if (document.visibilityState !== "visible" && Notification.permission === "granted") {
          try {
            new Notification("New booking request", {
              body: `A traveler submitted a new reservation for ${businessName}.`,
            });
          } catch {
            // ignore
          }
        }
      }
      const now = new Date().toISOString();

      setItems((prev) =>
        [
          {
            id: `booking-${bookingId}`,
            kind: "new_booking",
            title: "New booking request",
            subtitle: `${businessName}: reservation awaiting your review`,
            href: "/reservations",
            createdAt: now,
          },
          ...prev,
        ].slice(0, 30),
      );

      pushToast({
        title: "New booking request",
        body: `A traveler submitted a new reservation for ${businessName}.`,
        href: "/reservations",
      });

      // Let the Reservations page refresh immediately even if Realtime misses.
      try {
        window.dispatchEvent(new CustomEvent(RESERVATIONS_REFRESH_EVENT, { detail: { kind: "booking", id: bookingId } }));
      } catch {
        // ignore
      }
    },
    [pushToast],
  );

  const processNewRating = useCallback(
    async (row: { id?: string; business_id?: string; stars?: number | null }) => {
      const rid = row.id;
      const bid = row.business_id;
      const stars = row.stars;
      if (!rid || !bid || stars == null) return;
      if (!businessIdsRef.current.includes(bid)) return;
      if (seenRatingIds.current.has(rid)) return;

      seenRatingIds.current.add(rid);
      const name = businessNameRef.current.get(bid) || "Your listing";
      addRatingNotification(rid, bid, stars, name);
    },
    [addRatingNotification],
  );

  /** Travelers often upsert ratings → UPDATE, not INSERT. Notify when stars actually change. */
  const processRatingUpdate = useCallback(
    (payload: { old?: Record<string, unknown>; new?: Record<string, unknown> }) => {
      const newRow = payload.new as { id?: string; business_id?: string; stars?: number };
      const oldRow = payload.old as { stars?: number } | undefined;
      const rid = newRow.id;
      const bid = newRow.business_id;
      const stars = newRow.stars;
      if (!rid || !bid || stars == null) return;
      if (!businessIdsRef.current.includes(bid)) return;
      // Notify on any rating change (insert handled separately; updates may come from upsert).

      const name = businessNameRef.current.get(bid) || "Your listing";
      const notifId = `${rid}-u${stars}-${Date.now()}`;
      addRatingNotification(notifId, bid, stars, name, { kind: "changed" });
    },
    [addRatingNotification],
  );

  const processRatingDelete = useCallback(
    (payload: { old?: Record<string, unknown> }) => {
      const oldRow = payload.old as { id?: string; business_id?: string } | undefined;
      const rid = oldRow?.id;
      const bid = oldRow?.business_id;
      if (!rid || !bid) return;
      if (!businessIdsRef.current.includes(bid)) return;
      const name = businessNameRef.current.get(bid) || "Your listing";
      const notifId = `${rid}-d-${Date.now()}`;
      addRatingRemovedNotification(notifId, bid, name);
    },
    [addRatingRemovedNotification],
  );

  const processNewBooking = useCallback(
    async (row: { id?: string; business_id?: string; status?: string }) => {
      const bookingId = row.id;
      const bid = row.business_id;
      const status = row.status;
      if (!bookingId || !bid || status !== "pending_review") return;
      if (!businessIdsRef.current.includes(bid)) return;
      if (seenBookingIds.current.has(bookingId)) return;

      seenBookingIds.current.add(bookingId);
      const name = businessNameRef.current.get(bid) || "Your listing";
      addBookingNotification(bookingId, name);
    },
    [addBookingNotification],
  );

  useEffect(() => {
    businessIdsRef.current = businessIds;
  }, [businessIds]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid || cancelled) return;

      const { data: rows } = await supabase.from("businesses").select("id").eq("owner_id", uid);
      if (cancelled) return;
      const ids = (rows ?? []).map((r: { id: string }) => r.id);
      if (!ids.length) return;

      // Cache business names up-front so notifications can fire immediately even in background tabs.
      const { data: bizRows } = await supabase.from("businesses").select("id,name").in("id", ids);
      if (!cancelled) {
        const map = new Map<string, string>();
        for (const b of (bizRows as { id: string; name?: string | null }[]) ?? []) {
          const n = (b.name ?? "").trim();
          if (n) map.set(b.id, n);
        }
        businessNameRef.current = map;
      }

      const { data: ratingRows } = await supabase
        .from("business_ratings")
        .select("id")
        .in("business_id", ids)
        .order("created_at", { ascending: false })
        .limit(500);
      if (cancelled) return;
      for (const r of (ratingRows as { id: string }[]) ?? []) {
        seenRatingIds.current.add(r.id);
      }

      const { data: bookingRows } = await supabase
        .from("bookings")
        .select("id")
        .in("business_id", ids)
        .eq("status", "pending_review")
        .order("requested_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      for (const b of (bookingRows as { id: string }[]) ?? []) {
        seenBookingIds.current.add(b.id);
      }

      setBusinessIds(ids);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!businessIds.length) return;

    const channel = supabase
      .channel("destinaph-owner-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "business_ratings" }, (payload) => {
        const row = payload.new as { id?: string; business_id?: string; stars?: number };
        void processNewRating(row);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "business_ratings" }, (payload) => {
        processRatingUpdate({ old: payload.old as Record<string, unknown>, new: payload.new as Record<string, unknown> });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "business_ratings" }, (payload) => {
        processRatingDelete({ old: payload.old as Record<string, unknown> });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bookings" }, (payload) => {
        const row = payload.new as { id?: string; business_id?: string; status?: string };
        void processNewBooking(row);
      })
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            "[notifications] Owner Realtime issue — enable Replication for business_ratings and bookings in Supabase.",
            err,
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessIds, processNewBooking, processNewRating, processRatingUpdate, processRatingDelete]);

  useEffect(() => {
    if (!businessIds.length) return;

    const poll = async () => {
      if (pollBusyRef.current) return;
      pollBusyRef.current = true;
      const [ratingsRes, bookingsRes] = await Promise.all([
        supabase
          .from("business_ratings")
          .select("id,business_id,stars")
          .in("business_id", businessIds)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("bookings")
          .select("id,business_id,status")
          .in("business_id", businessIds)
          .eq("status", "pending_review")
          .order("requested_at", { ascending: false })
          .limit(40),
      ]);

      if (!ratingsRes.error) {
        for (const r of (ratingsRes.data as { id: string; business_id: string; stars: number }[]) ?? []) {
          if (seenRatingIds.current.has(r.id)) continue;
          await processNewRating(r);
        }
      }

      if (!bookingsRes.error) {
        for (const b of (bookingsRes.data as { id: string; business_id: string; status: string }[]) ?? []) {
          if (seenBookingIds.current.has(b.id)) continue;
          await processNewBooking(b);
        }
      }
      pollBusyRef.current = false;
    };

    // Run once immediately, then keep polling (helps if Realtime misses an event).
    void poll();

    const onFocus = () => void poll();
    const onVis = () => {
      // When returning to the tab, poll right away instead of waiting for the interval.
      if (document.visibilityState === "visible") void poll();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const onOnline = () => void poll();
    window.addEventListener("online", onOnline);

    // Realtime delivers inserts immediately; this short interval only catches rare misses (tab sleep, WS hiccup).
    const t = window.setInterval(() => void poll(), 4_000);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
    };
  }, [businessIds, processNewBooking, processNewRating, processRatingUpdate]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    const onClearBookings = () => {
      setItems((prev) => prev.filter((it) => it.kind !== "new_booking"));
    };
    window.addEventListener(CLEAR_BOOKING_NOTIFS_EVENT, onClearBookings);
    return () => window.removeEventListener(CLEAR_BOOKING_NOTIFS_EVENT, onClearBookings);
  }, []);

  const clearItems = useCallback(() => setItems([]), []);

  return {
    items,
    totalBadge: items.length,
    open,
    setOpen,
    toasts,
    dismissToast,
    wrapRef,
    clearItems,
  };
}