import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { playNotificationSound } from "../lib/notificationSound";

export type AdminNotifItem = {
  id: string;
  kind: "approval" | "premium";
  title: string;
  subtitle: string;
  href: string;
  createdAt: string;
};

export type AdminToast = {
  id: string;
  title: string;
  body: string;
  href: string;
};

function isPendingOwnerRow(r: Record<string, unknown>): boolean {
  return r.role === "business_owner" && r.owner_approval_status === "pending";
}

export function useAdminNotifications() {
  const [items, setItems] = useState<AdminNotifItem[]>([]);
  const [totalBadge, setTotalBadge] = useState(0);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const seenApprovalIdsRef = useRef(new Set<string>());
  const seenPremiumIdsRef = useRef(new Set<string>());
  const feedBootstrappedRef = useRef(false);

  const pushToast = useCallback((t: Omit<AdminToast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 6500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadFeed = useCallback(async () => {
    const [apRes, prRes, apCount, prCount, apIdsRes, prIdsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,registration_business_name,created_at")
        .eq("role", "business_owner")
        .eq("owner_approval_status", "pending")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("premium_upgrade_requests")
        .select("id,created_at,businesses(name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "business_owner")
        .eq("owner_approval_status", "pending"),
      supabase
        .from("premium_upgrade_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("profiles").select("id").eq("role", "business_owner").eq("owner_approval_status", "pending"),
      supabase.from("premium_upgrade_requests").select("id").eq("status", "pending"),
    ]);

    if (apRes.error) console.warn("[notifications] profiles:", apRes.error.message);
    if (prRes.error) console.warn("[notifications] premium_upgrade_requests:", prRes.error.message);
    if (apIdsRes.error) console.warn("[notifications] profiles ids:", apIdsRes.error.message);
    if (prIdsRes.error) console.warn("[notifications] premium ids:", prIdsRes.error.message);

    const serverApprovalIds = new Set(
      ((apIdsRes.data ?? []) as { id: string }[]).map((r) => r.id),
    );
    const serverPremiumIds = new Set(((prIdsRes.data ?? []) as { id: string }[]).map((r) => r.id));

    if (!apIdsRes.error && !prIdsRes.error) {
      if (!feedBootstrappedRef.current) {
        serverApprovalIds.forEach((id) => seenApprovalIdsRef.current.add(id));
        serverPremiumIds.forEach((id) => seenPremiumIdsRef.current.add(id));
        feedBootstrappedRef.current = true;
      } else {
        for (const id of serverApprovalIds) {
          if (!seenApprovalIdsRef.current.has(id)) {
            seenApprovalIdsRef.current.add(id);
            playNotificationSound();
            pushToast({
              title: "New business owner",
              body: "Someone registered and needs approval.",
              href: "/approvals",
            });
          }
        }
        for (const id of [...seenApprovalIdsRef.current]) {
          if (!serverApprovalIds.has(id)) seenApprovalIdsRef.current.delete(id);
        }

        for (const id of serverPremiumIds) {
          if (!seenPremiumIdsRef.current.has(id)) {
            seenPremiumIdsRef.current.add(id);
            playNotificationSound();
            pushToast({
              title: "Premium payment request",
              body: "A business submitted payment proof for review.",
              href: "/premium-payments",
            });
          }
        }
        for (const id of [...seenPremiumIdsRef.current]) {
          if (!serverPremiumIds.has(id)) seenPremiumIdsRef.current.delete(id);
        }
      }
    } else if (!feedBootstrappedRef.current) {
      feedBootstrappedRef.current = true;
    }

    const next: AdminNotifItem[] = [];
    for (const r of (apRes.data as { id: string; full_name: string | null; registration_business_name: string | null; created_at: string }[]) ?? []) {
      next.push({
        id: `approval-${r.id}`,
        kind: "approval",
        title: "New business owner registration",
        subtitle: r.full_name?.trim() || r.registration_business_name || "Pending approval",
        href: "/approvals",
        createdAt: r.created_at,
      });
    }
    for (const r of (prRes.data as { id: string; created_at: string; businesses: { name: string } | null }[]) ?? []) {
      next.push({
        id: `premium-${r.id}`,
        kind: "premium",
        title: "New premium payment request",
        subtitle: r.businesses?.name?.trim() || "Business submitted proof",
        href: "/premium-payments",
        createdAt: r.created_at,
      });
    }
    next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setItems(next);
    const badge = (apCount.count ?? 0) + (prCount.count ?? 0);
    setTotalBadge(badge);
  }, [pushToast]);

  const bumpFeed = useCallback(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    void loadFeed();
    const interval = window.setInterval(() => void loadFeed(), 16000);
    return () => window.clearInterval(interval);
  }, [loadFeed]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void loadFeed();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadFeed]);

  useEffect(() => {
    const channel = supabase
      .channel("destinaph-admin-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (isPendingOwnerRow(row)) bumpFeed();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const old = payload.old as Record<string, unknown> | undefined;
          const row = payload.new as Record<string, unknown>;
          if (!isPendingOwnerRow(row)) return;
          if (old?.owner_approval_status === "pending") return;
          bumpFeed();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "premium_upgrade_requests" },
        (payload) => {
          const row = payload.new as { status?: string };
          if (row.status === "pending") bumpFeed();
        },
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            "[notifications] Realtime channel issue — enable Replication for profiles & premium_upgrade_requests in Supabase. Polling still updates the bell.",
            err,
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bumpFeed]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return {
    items,
    totalBadge,
    open,
    setOpen,
    toasts,
    dismissToast,
    wrapRef,
    refresh: loadFeed,
  };
}
