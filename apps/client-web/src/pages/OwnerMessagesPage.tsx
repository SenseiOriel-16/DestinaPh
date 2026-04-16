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

      <div className="owner-chat__grid">
        <div className="card owner-chat__card owner-chat__inbox">
          <div className="owner-chat__inbox-head">Inbox</div>
          <div className="owner-chat__inbox-list">
            {convs.length === 0 ? (
              <div className="owner-chat__empty">No messages yet.</div>
            ) : (
              convs.map((c) => {
                const on = c.id === activeId;
                const title = `${c.businesses?.name ?? "Business"} · ${c.consumer?.full_name ?? c.consumer?.username ?? "Traveler"}`;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={`owner-chat__conv ${on ? "owner-chat__conv--active" : ""}`}
                  >
                    <div className="owner-chat__conv-title">{title}</div>
                    <div className="owner-chat__conv-preview">
                      {c.last_message_text ?? "—"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="card owner-chat__card owner-chat__thread">
          <div className="owner-chat__thread-title">
            {active ? (active.businesses?.name ?? "Messages") : "Messages"}
          </div>
          <div className="owner-chat__thread-body">
            {msgs.map((m) => (
              <div key={m.id} className="owner-chat__msg">
                {m.text ? <div className="owner-chat__msg-text">{m.text}</div> : null}
                {m.image_storage_path ? (
                  imgMap[m.id] ? (
                    <a href={imgMap[m.id]} target="_blank" rel="noreferrer">
                      <img src={imgMap[m.id]} alt="chat" className="owner-chat__msg-img" />
                    </a>
                  ) : (
                    <div className="owner-chat__msg-meta">Image…</div>
                  )
                ) : null}
                <div className="owner-chat__msg-meta">
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

