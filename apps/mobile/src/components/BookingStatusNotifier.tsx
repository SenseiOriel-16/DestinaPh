import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { InAppToast, type ToastModel } from "./InAppToast";
import { playNotificationSound } from "../lib/notificationSound";
import { BOOKING_OPEN_DETAIL_EVENT, emitBookingNotification } from "../lib/bookingNotificationEvents";
import { DeviceEventEmitter } from "react-native";
import { navigateToBookingsMain } from "../navigation/navRef";

type BookingRow = {
  id?: string;
  status?: string;
  owner_note?: string | null;
  business_id?: string;
};

function titleForStatus(status: string) {
  if (status === "confirmed") return "Reservation confirmed";
  if (status === "cancelled") return "Reservation rejected";
  if (status === "pending_review") return "Reservation sent";
  return "Reservation update";
}

export function BookingStatusNotifier() {
  const [toast, setToast] = useState<ToastModel | null>(null);
  const lastStatus = useRef<Map<string, string>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const uidRef = useRef<string | null>(null);
  const pollBusyRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);
  const pollBackoffMsRef = useRef<number>(4_000);

  const dismiss = useCallback(() => setToast(null), []);

  const handleStatusChange = useCallback((id: string, status: string, ownerNote?: string | null) => {
    const title = titleForStatus(status);
    const note = (ownerNote ?? "").trim();
    const body =
      status === "cancelled"
        ? note
          ? `Reason: ${note}`
          : "The host rejected your reservation."
        : status === "confirmed"
          ? "Your reservation was confirmed by the host."
          : `Status updated: ${status}`;

    setToast({
      title,
      body,
      onPress: () => {
        navigateToBookingsMain();
        DeviceEventEmitter.emit(BOOKING_OPEN_DETAIL_EVENT, { bookingId: id });
      },
    });
    emitBookingNotification({
      id: `${id}:${status}:${Date.now()}`,
      bookingId: id,
      title,
      body,
      createdAt: Date.now(),
    });
    void playNotificationSound();
  }, []);

  const pollOnce = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid || pollBusyRef.current) return;
    pollBusyRef.current = true;
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("id,status,owner_note")
        .eq("user_id", uid)
        .order("requested_at", { ascending: false })
        .limit(60);
      if (error) {
        // Avoid hammering the API if DB is unhealthy (e.g. 42P17 recursion).
        console.warn("[DestinaPH] bookings poll paused:", error.message);
        if (pollTimerRef.current != null) {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        pollBackoffMsRef.current = Math.min(60_000, Math.max(8_000, pollBackoffMsRef.current * 2));
        // Try again later (one-shot) in case backend recovers.
        pollTimerRef.current = window.setInterval(() => void pollOnce(), pollBackoffMsRef.current) as unknown as number;
        return;
      }
      for (const r of (data as { id: string; status: string; owner_note?: string | null }[]) ?? []) {
        const prev = lastStatus.current.get(r.id);
        if (!prev) {
          // Seed if not known.
          lastStatus.current.set(r.id, r.status);
          continue;
        }
        if (prev === r.status) continue;
        lastStatus.current.set(r.id, r.status);
        handleStatusChange(r.id, r.status, r.owner_note ?? null);
      }
    } finally {
      pollBusyRef.current = false;
    }
  }, [handleStatusChange]);

  useEffect(() => {
    let alive = true;

    const setup = async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid || !alive) return;
      uidRef.current = uid;

      // Seed lastStatus to avoid toasting on initial load.
      const { data: seed, error: seedErr } = await supabase
        .from("bookings")
        .select("id,status")
        .eq("user_id", uid)
        .order("requested_at", { ascending: false })
        .limit(200);
      if (seedErr) {
        console.warn("[DestinaPH] bookings seed skipped:", seedErr.message);
      }
      for (const r of (seed as { id: string; status: string }[]) ?? []) {
        lastStatus.current.set(r.id, r.status);
      }

      const ch = supabase
        .channel("destinaph-consumer-booking-notifs")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "bookings", filter: `user_id=eq.${uid}` },
          (payload) => {
            const row = payload.new as BookingRow;
            const id = row.id;
            const status = row.status;
            if (!id || !status) return;

            const prev = lastStatus.current.get(id);
            lastStatus.current.set(id, status);
            if (!prev || prev === status) return;

            handleStatusChange(id, status, row.owner_note ?? null);
          },
        )
        .subscribe();

      channelRef.current = ch;

      // Fallback polling in case Realtime is not enabled / app was backgrounded.
      // Run once immediately, then keep a light interval.
      void pollOnce();
      pollBackoffMsRef.current = 4_000;
      pollTimerRef.current = window.setInterval(() => void pollOnce(), pollBackoffMsRef.current) as unknown as number;
    };

    void setup();

    return () => {
      alive = false;
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (pollTimerRef.current != null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [handleStatusChange, pollOnce]);

  return <InAppToast toast={toast} onDismiss={dismiss} />;
}

