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
  edited_at: string | null;
  is_read_by_admin: boolean;
};

function msgTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

const SUPPORT_MSG_EDIT_WINDOW_MS = 5 * 60 * 1000;

function supportMessageWithinEditWindow(createdAtIso: string): boolean {
  const t = new Date(createdAtIso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= SUPPORT_MSG_EDIT_WINDOW_MS;
}

export function SupportInboxPage() {
  const [convs, setConvs] = useState<ConversationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const selected = useMemo(() => convs.find((c) => c.id === selectedId) ?? null, [convs, selectedId]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    setOpenMenuId(null);
  }, [selectedId]);

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
    setSelectedId((cur) => {
      if (cur && list.some((c) => c.id === cur)) return cur;
      return list[0]?.id ?? null;
    });
  }, []);

  const loadMsgs = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from("support_messages")
      .select("id,conversation_id,sender_id,sender_role,body,created_at,edited_at,is_read_by_admin")
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
          if (row.sender_role === "business_owner")
            void supabase.from("support_messages").update({ is_read_by_admin: true }).eq("id", row.id);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "support_messages" }, (payload) => {
        const row = payload.new as Msg;
        void loadConvs();
        if (row.conversation_id === selectedId) {
          setMsgs((prev) => prev.map((m) => (m.id === row.id ? row : m)));
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "support_messages" }, (payload) => {
        const oldRow = payload.old as { id?: string; conversation_id?: string };
        void loadConvs();
        if (oldRow.conversation_id === selectedId && oldRow.id) {
          setMsgs((prev) => prev.filter((m) => m.id !== oldRow.id));
          setEditingId((e) => (e === oldRow.id ? null : e));
          setOpenMenuId((o) => (o === oldRow.id ? null : o));
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadConvs, selectedId]);

  useEffect(() => {
    if (!openMenuId) return;
    const onDoc = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("[data-admin-support-msg-menu]")) return;
      setOpenMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenuId]);

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

  const startEdit = (m: Msg) => {
    setOpenMenuId(null);
    setEditingId(m.id);
    setEditText(m.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const target = msgs.find((x) => x.id === editingId);
    if (target && !supportMessageWithinEditWindow(target.created_at)) {
      setErr("You can only edit a message within 5 minutes of sending.");
      cancelEdit();
      return;
    }
    const body = editText.trim();
    if (!body) {
      setErr("Message cannot be empty.");
      return;
    }
    setErr(null);
    const { error } = await supabase.from("support_messages").update({ body }).eq("id", editingId);
    if (error) {
      setErr(error.message);
      return;
    }
    cancelEdit();
  };

  const deleteMessage = async (id: string) => {
    if (!window.confirm("Delete this message?")) return;
    setErr(null);
    const { error } = await supabase.from("support_messages").delete().eq("id", id);
    if (error) setErr(error.message);
  };

  const deleteConversation = async () => {
    if (!selected?.id) return;
    if (!window.confirm("Delete this entire conversation? All messages will be removed.")) return;
    setErr(null);
    const id = selected.id;
    const { error } = await supabase.from("support_conversations").delete().eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }
    setSelectedId(null);
    setMsgs([]);
    setEditingId(null);
    setEditText("");
    setOpenMenuId(null);
    await loadConvs();
  };

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
                    {person && biz ? <div className="admin-support__list-sub">{biz}</div> : null}
                    <div className="admin-support__list-time">{msgTime(c.last_message_at)}</div>
                  </button>
                );
              })}
              {convs.length === 0 ? <div className="admin-support__list-empty">No messages yet.</div> : null}
            </div>
          </aside>

          <section className="admin-support__thread">
            <div className="admin-support__thread-head">
              <div className="admin-support__thread-head-text">
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
              {selected ? (
                <button type="button" className="btn btn-outline admin-support__delete-conv" onClick={() => void deleteConversation()}>
                  Delete conversation
                </button>
              ) : null}
            </div>

            <div className="admin-support__feed" role="log" aria-label="Support messages">
              {msgs.length === 0 ? (
                <div className="admin-support__feed-empty">No messages in this conversation yet.</div>
              ) : (
                msgs.map((m) => {
                  const mine = m.sender_role === "admin";
                  const canEdit = meId !== null && m.sender_id === meId && supportMessageWithinEditWindow(m.created_at);
                  const canDelete = true;
                  const isEditing = editingId === m.id;
                  const showMenu = !isEditing && (canEdit || canDelete);
                  return (
                    <div key={m.id} className={`admin-support__msg${mine ? " admin-support__msg--mine" : ""}`}>
                      <div className={`admin-support__msg-inner${mine ? " admin-support__msg-inner--mine" : ""}`}>
                        {showMenu ? (
                          <div className="admin-support__menu-col" data-admin-support-msg-menu>
                            <button
                              type="button"
                              className="admin-support__menu-btn"
                              aria-label="Message options"
                              aria-expanded={openMenuId === m.id}
                              aria-haspopup="true"
                              onClick={() => setOpenMenuId((cur) => (cur === m.id ? null : m.id))}
                            >
                              <span className="admin-support__menu-dots" aria-hidden>
                                ⋮
                              </span>
                            </button>
                            {openMenuId === m.id ? (
                              <div className="admin-support__menu" role="menu">
                                {canEdit ? (
                                  <button type="button" role="menuitem" className="admin-support__menu-item" onClick={() => startEdit(m)}>
                                    Edit
                                  </button>
                                ) : null}
                                {canDelete ? (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="admin-support__menu-item admin-support__menu-item--danger"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      void deleteMessage(m.id);
                                    }}
                                  >
                                    Delete
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="admin-support__bubble">
                          {isEditing ? (
                            <div className="admin-support__edit">
                              <textarea
                                className="admin-support__input admin-support__edit-input"
                                rows={3}
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                              />
                              <div className="admin-support__edit-actions">
                                <button type="button" className="btn btn-primary btn-inline" onClick={() => void saveEdit()}>
                                  Save
                                </button>
                                <button type="button" className="btn btn-outline btn-inline" onClick={cancelEdit}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="admin-support__text">{m.body}</div>
                          )}
                          <div className="admin-support__meta">
                            {msgTime(m.created_at)}
                            {m.edited_at ? <span className="admin-support__edited"> · Edited</span> : null}
                          </div>
                        </div>
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
                <button type="button" className="btn btn-primary" disabled={busy || !draft.trim() || !selected} onClick={() => void send()}>
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
