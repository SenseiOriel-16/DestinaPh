import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type ConversationRow = {
  id: string;
  owner_id: string;
  last_message_at: string;
  profiles: { full_name: string | null; registration_business_name: string | null } | null;
};

type Msg = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "business_owner" | "admin";
  body: string;
  created_at: string;
  is_read_by_admin: boolean;
};

function msgTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function SupportInboxPage() {
  const [convs, setConvs] = useState<ConversationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => convs.find((c) => c.id === selectedId) ?? null, [convs, selectedId]);

  const loadConvs = useCallback(async () => {
    setErr(null);
    const { data, error } = await supabase
      .from("support_conversations")
      .select("id,owner_id,last_message_at,profiles:owner_id(full_name,registration_business_name)")
      .order("last_message_at", { ascending: false })
      .limit(250);
    if (error) {
      setErr(error.message);
      return;
    }
    const list = (data as unknown as ConversationRow[]) ?? [];
    setConvs(list);
    if (!selectedId && list[0]?.id) setSelectedId(list[0].id);
  }, [selectedId]);

  const loadMsgs = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from("support_messages")
      .select("id,conversation_id,sender_id,sender_role,body,created_at,is_read_by_admin")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) {
      setErr(error.message);
      return;
    }
    setMsgs((data as Msg[]) ?? []);
  }, []);

  const markOwnerMsgsRead = useCallback(async (conversationId: string) => {
    await supabase
      .from("support_messages")
      .update({ is_read_by_admin: true })
      .eq("conversation_id", conversationId)
      .eq("sender_role", "business_owner")
      .eq("is_read_by_admin", false);
  }, []);

  useEffect(() => {
    void loadConvs();
  }, [loadConvs]);

  useEffect(() => {
    if (!selectedId) return;
    void loadMsgs(selectedId);
    void markOwnerMsgsRead(selectedId);
  }, [selectedId, loadMsgs, markOwnerMsgsRead]);

  useEffect(() => {
    const channel = supabase
      .channel("destinaph-support-admin-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, (payload) => {
        const row = payload.new as Msg;
        void loadConvs();
        if (row.conversation_id === selectedId) {
          setMsgs((prev) => [...prev, row]);
          if (row.sender_role === "business_owner") void supabase.from("support_messages").update({ is_read_by_admin: true }).eq("id", row.id);
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadConvs, selectedId]);

  const send = useCallback(async () => {
    if (!selected) return;
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setErr(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        setErr("Please sign in again.");
        return;
      }
      const { error } = await supabase.from("support_messages").insert({
        conversation_id: selected.id,
        sender_id: uid,
        sender_role: "admin",
        body,
        is_read_by_admin: true,
        is_read_by_owner: false,
      });
      if (error) {
        setErr(error.message);
        return;
      }
      setDraft("");
    } finally {
      setBusy(false);
    }
  }, [draft, selected]);

  return (
    <div className="page page--wide">
      <header className="card admin-support__hero">
        <h1 className="admin-support__title">Support</h1>
        <p className="admin-support__sub">Messages from business owners.</p>
      </header>

      {err ? <div className="alert-banner alert-banner--error">{err}</div> : null}

      <div className="card admin-support__card">
        <div className="admin-support__grid">
          <aside className="admin-support__list">
            <div className="admin-support__list-head">Conversations</div>
            <div className="admin-support__list-scroll">
              {convs.map((c) => {
                const on = c.id === selectedId;
                const person = c.profiles?.full_name?.trim();
                const biz = c.profiles?.registration_business_name?.trim();
                const name = person || biz || c.owner_id.slice(0, 8);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`admin-support__list-item${on ? " is-active" : ""}`}
                  >
                    <div className="admin-support__list-name">{name}</div>
                    {person && biz ? (
                      <div className="admin-support__list-sub">{biz}</div>
                    ) : null}
                    <div className="admin-support__list-time">{msgTime(c.last_message_at)}</div>
                  </button>
                );
              })}
              {convs.length === 0 ? <div className="admin-support__list-empty">No messages yet.</div> : null}
            </div>
          </aside>

          <section className="admin-support__thread">
            <div className="admin-support__thread-head">
              <div className="admin-support__thread-title">
                {selected?.profiles?.full_name?.trim() ||
                  selected?.profiles?.registration_business_name?.trim() ||
                  (selected ? selected.owner_id.slice(0, 8) : "—")}
              </div>
              <div className="admin-support__thread-sub">
                {selected?.profiles?.registration_business_name?.trim()
                  ? `Business: ${selected.profiles.registration_business_name.trim()}`
                  : `Owner ID: ${selected ? selected.owner_id.slice(0, 8) : "—"}`}
              </div>
            </div>

            <div className="admin-support__feed" role="log" aria-label="Support messages">
              {msgs.length === 0 ? (
                <div className="admin-support__feed-empty">No messages in this conversation yet.</div>
              ) : (
                msgs.map((m) => {
                  const mine = m.sender_role === "admin";
                  return (
                    <div
                      key={m.id}
                      className={`admin-support__msg${mine ? " admin-support__msg--mine" : ""}`}
                    >
                      <div className="admin-support__bubble">
                        <div className="admin-support__text">{m.body}</div>
                        <div className="admin-support__meta">{msgTime(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="admin-support__composer">
              <textarea
                rows={2}
                placeholder="Write a reply…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="admin-support__input"
              />
              <div className="admin-support__composer-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !draft.trim() || !selected}
                  onClick={() => void send()}
                >
                  {busy ? "Sending…" : "Send reply"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

