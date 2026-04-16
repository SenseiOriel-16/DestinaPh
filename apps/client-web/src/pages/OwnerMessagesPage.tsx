import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { playNotificationSound } from "../lib/notificationSound";

type Conversation = {
  id: string;
  consumer_id: string;
  business_id: string;
  last_message_at: string | null;
  last_message_text: string | null;
  businesses: { id: string; name: string | null } | null;
  consumer: { id: string; full_name: string | null; username: string | null } | null;
};

type Msg = {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  text: string | null;
  image_storage_path: string | null;
  created_at: string;
};

async function signedChatImageUrl(path: string): Promise<string | null> {
  const p = (path ?? "").trim();
  if (!p) return null;
  const { data, error } = await supabase.storage.from("chat-images").createSignedUrl(p, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function OwnerMessagesPage() {
  const [bizIds, setBizIds] = useState<string[]>([]);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [imgMap, setImgMap] = useState<Record<string, string>>({});
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const active = useMemo(() => convs.find((c) => c.id === activeId) ?? null, [convs, activeId]);

  const loadBizIds = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const { data } = await supabase.from("businesses").select("id").eq("owner_id", uid);
    setBizIds((data ?? []).map((r: { id: string }) => r.id));
  }, []);

  const loadConvs = useCallback(async (ids: string[]) => {
    if (!ids.length) {
      setConvs([]);
      return;
    }
    // Join consumer profile via FK on profiles table.
    const { data } = await supabase
      .from("conversations")
      .select("id,consumer_id,business_id,last_message_at,last_message_text,businesses(id,name),consumer:profiles!conversations_consumer_id_fkey(id,full_name,username)")
      .in("business_id", ids)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    setConvs((data as any) ?? []);
    if (!activeId && (data as any)?.[0]?.id) setActiveId((data as any)[0].id);
  }, [activeId]);

  const loadMsgs = useCallback(async (conversationId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_profile_id,text,image_storage_path,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMsgs((data as any) ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      await loadBizIds();
    })();
  }, [loadBizIds]);

  useEffect(() => {
    void loadConvs(bizIds);
  }, [bizIds, loadConvs]);

  useEffect(() => {
    if (!activeId) return;
    void loadMsgs(activeId);
  }, [activeId, loadMsgs]);

  useEffect(() => {
    if (!activeId) return;
    if (subRef.current) void supabase.removeChannel(subRef.current);
    const ch = supabase
      .channel(`owner-chat-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMsgs((prev) => [...prev, m]);
          void loadConvs(bizIds);
          // Play sound when someone else sent it.
          void (async () => {
            const { data: auth } = await supabase.auth.getUser();
            const uid = auth.user?.id;
            if (uid && m.sender_profile_id !== uid) playNotificationSound();
          })();
        },
      )
      .subscribe();
    subRef.current = ch;
    return () => {
      void supabase.removeChannel(ch);
      subRef.current = null;
    };
  }, [activeId, bizIds, loadConvs]);

  useEffect(() => {
    const need = msgs.filter((m) => m.image_storage_path && !imgMap[m.id]).slice(-8);
    if (!need.length) return;
    void (async () => {
      const entries = await Promise.all(
        need.map(async (m) => {
          const url = await signedChatImageUrl(m.image_storage_path!);
          return url ? ([m.id, url] as const) : null;
        }),
      );
      const next: Record<string, string> = {};
      for (const e of entries) if (e) next[e[0]] = e[1];
      if (Object.keys(next).length) setImgMap((prev) => ({ ...prev, ...next }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs.length]);

  const send = async () => {
    const t = draft.trim();
    if (!activeId || !t) return;
    setDraft("");
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    await supabase.from("messages").insert({ conversation_id: activeId, sender_profile_id: uid, text: t });
  };

  const sendImage = async (file: File) => {
    if (!activeId) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const ext = file.type.split("/")[1] || "jpg";
    const path = `${uid}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("chat-images").upload(path, file, { contentType: file.type });
    if (up.error) return;
    await supabase.from("messages").insert({ conversation_id: activeId, sender_profile_id: uid, image_storage_path: path });
  };

  return (
    <div className="page page--wide">
      <header className="admin-page-hero admin-page-hero--compact">
        <div className="admin-page-hero__text">
          <p className="admin-page-hero__eyebrow">Chat</p>
          <h1 className="dash-title admin-page-hero__title">Messages</h1>
          <p className="dash-sub admin-page-hero__sub">Reply to traveler messages in real time.</p>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: 14, borderBottom: "1px solid var(--border)", fontWeight: 800 }}>Inbox</div>
          <div style={{ maxHeight: "70vh", overflow: "auto" }}>
            {convs.length === 0 ? (
              <div style={{ padding: 14, color: "var(--muted)" }}>No messages yet.</div>
            ) : (
              convs.map((c) => {
                const on = c.id === activeId;
                const title = `${c.businesses?.name ?? "Business"} · ${c.consumer?.full_name ?? c.consumer?.username ?? "Traveler"}`;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: 14,
                      border: "none",
                      background: on ? "rgba(8,143,143,0.10)" : "transparent",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{title}</div>
                    <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 12 }}>
                      {c.last_message_text ?? "—"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: "70vh" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>
            {active ? (active.businesses?.name ?? "Messages") : "Messages"}
          </div>
          <div style={{ marginTop: 10, flex: 1, overflow: "auto", padding: "10px 0" }}>
            {msgs.map((m) => (
              <div key={m.id} style={{ padding: "8px 0" }}>
                {m.text ? <div style={{ fontWeight: 600 }}>{m.text}</div> : null}
                {m.image_storage_path ? (
                  imgMap[m.id] ? (
                    <a href={imgMap[m.id]} target="_blank" rel="noreferrer">
                      <img src={imgMap[m.id]} alt="chat" style={{ maxWidth: 360, borderRadius: 12, marginTop: 6 }} />
                    </a>
                  ) : (
                    <div style={{ color: "var(--muted)" }}>Image…</div>
                  )
                ) : null}
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
          <div className="chat-composer">
            <label className="btn btn-ghost chat-composer__upload" style={{ margin: 0 }}>
              Upload
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void sendImage(f);
                }}
              />
            </label>
            <input
              className="chat-composer__input"
              placeholder="Type a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
            />
            <button type="button" className="btn btn-primary" onClick={() => void send()} disabled={!activeId}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

