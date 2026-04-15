import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { playNotificationSound } from "../lib/notificationSound";

export type OwnerSupportMsgNotif = {
  id: string;
  conversation_id: string;
  body: string;
  created_at: string;
  is_read_by_owner: boolean;
};

type Conversation = { id: string; owner_id: string };

export function useOwnerSupportMessages() {
  const [conv, setConv] = useState<Conversation | null>(null);
  const [items, setItems] = useState<OwnerSupportMsgNotif[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const bootRef = useRef(false);

  const ensureConversation = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return null;

    const { data: existing } = await supabase
      .from("support_conversations")
      .select("id,owner_id")
      .eq("owner_id", uid)
      .maybeSingle();
    if (existing?.id) return existing as Conversation;

    const { data: inserted } = await supabase
      .from("support_conversations")
      .insert({ owner_id: uid })
      .select("id,owner_id")
      .maybeSingle();

    return (inserted as Conversation) ?? null;
  }, []);

  const load = useCallback(
    async (conversationId: string) => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("id,conversation_id,body,created_at,is_read_by_owner")
        .eq("conversation_id", conversationId)
        .eq("sender_role", "admin")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) return;
      setItems((data as OwnerSupportMsgNotif[]) ?? []);
      if (!bootRef.current) bootRef.current = true;
    },
    [],
  );

  const unreadCount = useMemo(() => items.filter((x) => !x.is_read_by_owner).length, [items]);

  const markAllRead = useCallback(async () => {
    if (!conv?.id) return;
    await supabase
      .from("support_messages")
      .update({ is_read_by_owner: true })
      .eq("conversation_id", conv.id)
      .eq("sender_role", "admin")
      .eq("is_read_by_owner", false);
    void load(conv.id);
  }, [conv?.id, load]);

  const clearList = useCallback(() => setItems([]), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const c = await ensureConversation();
      if (cancelled) return;
      setConv(c);
      if (c?.id) void load(c.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureConversation, load]);

  useEffect(() => {
    if (!conv?.id) return;
    const onVis = () => {
      if (document.visibilityState === "visible") void load(conv.id);
    };
    const onOnline = () => void load(conv.id);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    // Realtime is primary; brief polling catches edge cases only.
    const t = window.setInterval(() => void load(conv.id), 4_000);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
    };
  }, [conv?.id, load]);

  useEffect(() => {
    if (!conv?.id) return;
    const channel = supabase
      .channel(`destinaph-owner-support-msgs-${conv.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${conv.id}` },
        (payload) => {
          const row = payload.new as { sender_role?: string };
          if (row.sender_role !== "admin") return;
          if (bootRef.current) playNotificationSound();
          void load(conv.id);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_messages", filter: `conversation_id=eq.${conv.id}` },
        () => void load(conv.id),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "support_messages", filter: `conversation_id=eq.${conv.id}` },
        () => void load(conv.id),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conv?.id, load]);

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
    conv,
    items,
    unreadCount,
    open,
    setOpen,
    wrapRef,
    markAllRead,
    clearList,
  };
}

