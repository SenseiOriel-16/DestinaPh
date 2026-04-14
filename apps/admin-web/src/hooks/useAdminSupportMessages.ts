import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { playNotificationSound } from "../lib/notificationSound";

export type AdminSupportMsgNotif = {
  id: string;
  conversation_id: string;
  body: string;
  created_at: string;
  is_read_by_admin: boolean;
};

export function useAdminSupportMessages() {
  const [items, setItems] = useState<AdminSupportMsgNotif[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const bootRef = useRef(false);

  const load = useCallback(async () => {
    // Show the most recent owner → admin messages, not just unread,
    // so "read" items stay visible unless manually cleared.
    const { data, error } = await supabase
      .from("support_messages")
      .select("id,conversation_id,body,created_at,is_read_by_admin")
      .eq("sender_role", "business_owner")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return;
    setItems((data as AdminSupportMsgNotif[]) ?? []);
    if (!bootRef.current) bootRef.current = true;
  }, []);

  const unreadCount = useMemo(() => items.filter((x) => !x.is_read_by_admin).length, [items]);

  const markConversationRead = useCallback(async (conversationId: string) => {
    await supabase
      .from("support_messages")
      .update({ is_read_by_admin: true })
      .eq("conversation_id", conversationId)
      .eq("sender_role", "business_owner")
      .eq("is_read_by_admin", false);
    void load();
  }, [load]);

  const clearList = useCallback(() => {
    setItems([]);
  }, []);

  useEffect(() => {
    void load();
    const onOnline = () => void load();
    window.addEventListener("online", onOnline);
    const t = window.setInterval(() => void load(), 4_000);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("online", onOnline);
    };
  }, [load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("destinaph-admin-support-msgs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, (payload) => {
        const row = payload.new as Partial<AdminSupportMsgNotif> & { sender_role?: string };
        if (row.sender_role !== "business_owner") return;
        if (bootRef.current) playNotificationSound();
        void load();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

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
    unreadCount,
    open,
    setOpen,
    wrapRef,
    markConversationRead,
    clearList,
    refresh: load,
  };
}

