import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "../lib/supabaseClient";

import { playNotificationSound } from "../lib/notificationSound";



export type OwnerNotifItem = {

  id: string;

  kind: "premium_active" | "new_rating" | "new_reservation_payment";

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

  const seenSubIds = useRef<Set<string>>(new Set());

  const seenRatingIds = useRef<Set<string>>(new Set());

  const seenBookingIds = useRef<Set<string>>(new Set());

  const businessIdsRef = useRef<string[]>([]);



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



  const addPremiumNotification = useCallback(

    (businessId: string, subtitle: string) => {

      playNotificationSound();

      const id = `premium-${businessId}-${Date.now()}`;

      const now = new Date().toISOString();

      setItems((prev) =>

        [

          {

            id,

            kind: "premium_active",

            title: "Premium is now active",

            subtitle,

            href: "/upgrade",

            createdAt: now,

          },

          ...prev,

        ].slice(0, 30),

      );

      pushToast({

        title: "Premium enabled",

        body: "Your listing now has premium features. Open Premium to explore tools.",

        href: "/upgrade",

      });

    },

    [pushToast],

  );



  const addRatingNotification = useCallback(

    (ratingId: string, businessId: string, stars: number, businessName: string) => {

      playNotificationSound();

      const id = `rating-${ratingId}`;

      const now = new Date().toISOString();

      const starLabel = `${stars} star${stars === 1 ? "" : "s"}`;

      setItems((prev) =>

        [

          {

            id,

            kind: "new_rating",

            title: "New traveler rating",

            subtitle: `${businessName}: ${starLabel}`,

            href: `/listings/${businessId}`,

            createdAt: now,

          },

          ...prev,

        ].slice(0, 30),

      );

      pushToast({

        title: "New rating on your listing",

        body: `${businessName} received ${stars}★ from a traveler.`,

        href: `/listings/${businessId}`,

      });

    },

    [pushToast],

  );

  const addBookingPaymentNotification = useCallback(
    (bookingId: string, businessId: string, businessName: string) => {
      playNotificationSound();

      const id = `booking-${bookingId}`;
      const now = new Date().toISOString();

      setItems((prev) =>
        [
          {
            id,
            kind: "new_reservation_payment",
            title: "New reservation payment",
            subtitle: `${businessName}: payment proof submitted`,
            href: "/reservations",
            createdAt: now,
          },
          ...prev,
        ].slice(0, 30),
      );

      pushToast({
        title: "New reservation payment proof",
        body: `A traveler submitted payment proof for ${businessName}.`,
        href: "/reservations",
      });
    },
    [pushToast],
  );



  const processNewRating = useCallback(

    async (row: { id?: string; business_id?: string; stars?: number | null }) => {

      const rid = row.id;

      const bid = row.business_id;

      const stars = row.stars;

      if (!rid || !bid || stars == null) return;

      const ids = businessIdsRef.current;

      if (!ids.includes(bid)) return;

      if (seenRatingIds.current.has(rid)) return;

      seenRatingIds.current.add(rid);

      const { data: b } = await supabase.from("businesses").select("name").eq("id", bid).maybeSingle();

      const name = (b as { name?: string } | null)?.name?.trim() || "Your listing";

      addRatingNotification(rid, bid, stars, name);

    },

    [addRatingNotification],

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

      const { data: rows } = await supabase.from("businesses").select("id,name").eq("owner_id", uid);

      if (cancelled) return;

      const ids = (rows ?? []).map((r: { id: string }) => r.id);

      if (!ids.length) return;



      const { data: subs } = await supabase

        .from("business_subscriptions")

        .select("id,business_id,started_at")

        .in("business_id", ids)

        .order("started_at", { ascending: false })

        .limit(5);

      if (cancelled) return;

      for (const s of (subs as { id: string; business_id: string; started_at: string }[]) ?? []) {

        seenSubIds.current.add(s.id);

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
        .limit(30);

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

      .on(

        "postgres_changes",

        { event: "INSERT", schema: "public", table: "business_subscriptions" },

        (payload) => {

          const row = payload.new as { id?: string; business_id?: string };

          const bid = row.business_id;

          const sid = row.id;

          if (!bid || !businessIds.includes(bid)) return;

          if (sid && seenSubIds.current.has(sid)) return;

          if (sid) seenSubIds.current.add(sid);

          void (async () => {

            const { data: b } = await supabase.from("businesses").select("name").eq("id", bid).maybeSingle();

            const name = (b as { name?: string } | null)?.name?.trim() || "Your business";

            addPremiumNotification(bid, name);

          })();

        },

      )

      .on(

        "postgres_changes",

        { event: "INSERT", schema: "public", table: "business_ratings" },

        (payload) => {

          const row = payload.new as { id?: string; business_id?: string; stars?: number };

          void processNewRating(row);

        },

      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bookings" },
        (payload) => {
          const row = payload.new as { id?: string; business_id?: string; status?: string };
          const bid = row.business_id;
          const bookingId = row.id;
          const status = row.status;

          if (!bid || !bookingId) return;
          if (!businessIds.includes(bid)) return;
          if (status !== "pending_review") return;
          if (seenBookingIds.current.has(bookingId)) return;

          seenBookingIds.current.add(bookingId);

          void (async () => {
            const { data: b } = await supabase.from("businesses").select("name").eq("id", bid).maybeSingle();
            const name = (b as { name?: string } | null)?.name?.trim() || "Your listing";
            addBookingPaymentNotification(bookingId, bid, name);
          })();
        },
      )

      .subscribe((status, err) => {

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {

          console.warn(

            "[notifications] Owner Realtime issue — enable Replication for business_subscriptions, business_ratings, and bookings in Supabase.",

            err,

          );

        }

      });



    return () => {

      void supabase.removeChannel(channel);

    };

  }, [businessIds, addPremiumNotification, processNewRating, addBookingPaymentNotification]);



  useEffect(() => {

    if (!businessIds.length) return;

    const poll = async () => {

      const { data, error } = await supabase

        .from("business_ratings")

        .select("id,business_id,stars")

        .in("business_id", businessIds)

        .order("created_at", { ascending: false })

        .limit(40);

      if (error) return;

      for (const r of (data as { id: string; business_id: string; stars: number }[]) ?? []) {

        if (seenRatingIds.current.has(r.id)) continue;

        await processNewRating(r);

      }

    };

    const t = window.setInterval(() => void poll(), 55_000);

    return () => window.clearInterval(t);

  }, [businessIds, processNewRating]);



  useEffect(() => {

    if (!open) return;

    const onDoc = (e: MouseEvent) => {

      const el = wrapRef.current;

      if (el && !el.contains(e.target as Node)) setOpen(false);

    };

    document.addEventListener("mousedown", onDoc);

    return () => document.removeEventListener("mousedown", onDoc);

  }, [open]);



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


