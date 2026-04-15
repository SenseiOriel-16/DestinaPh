import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { playNotificationSound } from "../lib/notificationSound";

type Conversation = {
  id: string;
  owner_id: string;
  owner_cleared_at?: string | null;
};

type Msg = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "business_owner" | "admin";
  body: string;
  created_at: string;
  edited_at: string | null;
};

const SUPPORT_MSG_EDIT_WINDOW_MS = 5 * 60 * 1000;

function supportMessageWithinEditWindow(createdAtIso: string): boolean {
  const t = new Date(createdAtIso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= SUPPORT_MSG_EDIT_WINDOW_MS;
}

export function SupportPage() {
  const [conv, setConv] = useState<Conversation | null>(null);
  const [rows, setRows] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => Boolean(conv?.id) && draft.trim().length > 0 && !busy, [conv?.id, draft, busy]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const ensureConversation = useCallback(async (): Promise<Conversation | null> => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    setMeId(uid ?? null);
    if (!uid) return null;

    const { data: existing, error: selErr } = await supabase
      .from("support_conversations")
      .select("id,owner_id,owner_cleared_at")
      .eq("owner_id", uid)
      .maybeSingle();

    if (selErr) {
      setErr(selErr.message);
      return null;
    }
    if (existing?.id) return existing as Conversation;

    const { data: inserted, error: insErr } = await supabase
      .from("support_conversations")
      .insert({ owner_id: uid })
      .select("id,owner_id,owner_cleared_at")
      .maybeSingle();

    if (insErr) {
      const { data: again, error: againErr } = await supabase
        .from("support_conversations")
        .select("id,owner_id")
        .eq("owner_id", uid)
        .maybeSingle();
      if (againErr) setErr(againErr.message);
      return (again as Conversation) ?? null;
    }

    return (inserted as Conversation) ?? null;
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from("support_messages")
      .select("id,conversation_id,sender_id,sender_role,body,created_at,edited_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) {
      setErr(error.message);
      return;
    }
    const list = (data as Msg[]) ?? [];
    const clearedAt = conv?.owner_cleared_at;
    if (clearedAt) {
      const cut = new Date(clearedAt).getTime();
      setRows(list.filter((m) => new Date(m.created_at).getTime() > cut));
    } else {
      setRows(list);
    }
    window.setTimeout(scrollToBottom, 50);
  }, [conv?.owner_cleared_at]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setErr(null);
      const c = await ensureConversation();
      if (cancelled) return;
      setConv(c);
      if (c?.id) await loadMessages(c.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureConversation, loadMessages]);

  useEffect(() => {
    if (!conv?.id) return;

    const channel = supabase
      .channel(`destinaph-support-owner-${conv.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${conv.id}` },
        (payload) => {
          const row = payload.new as Msg;
          const clearedAt = conv?.owner_cleared_at;
          if (clearedAt && new Date(row.created_at) <= new Date(clearedAt)) return;
          setRows((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          if (row.sender_role === "admin") playNotificationSound();
          window.setTimeout(scrollToBottom, 30);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_messages", filter: `conversation_id=eq.${conv.id}` },
        (payload) => {
          const row = payload.new as Msg;
          setRows((prev) => prev.map((m) => (m.id === row.id ? row : m)));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "support_messages", filter: `conversation_id=eq.${conv.id}` },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          const id = oldRow?.id;
          if (!id) return;
          setRows((prev) => prev.filter((m) => m.id !== id));
          setEditingId((e) => (e === id ? null : e));
          setOpenMenuId((o) => (o === id ? null : o));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conv?.id]);

  useEffect(() => {
    if (!openMenuId) return;
    const onDoc = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("[data-support-msg-menu]")) return;
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

  useEffect(() => {
    if (!conv?.id) return;
    void supabase
      .from("support_messages")
      .update({ is_read_by_owner: true })
      .eq("conversation_id", conv.id)
      .eq("sender_role", "admin")
      .eq("is_read_by_owner", false);
  }, [conv?.id, rows.length]);

  const send = useCallback(async () => {
    if (!conv?.id) return;
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
      const { data, error } = await supabase
        .from("support_messages")
        .insert({
          conversation_id: conv.id,
          sender_id: uid,
          sender_role: "business_owner",
          body,
          is_read_by_owner: true,
          is_read_by_admin: false,
        })
        .select("id,conversation_id,sender_id,sender_role,body,created_at,edited_at")
        .maybeSingle();
      if (error) {
        setErr(error.message);
        return;
      }
      if (data?.id) {
        const row = data as Msg;
        setRows((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
      }
      setDraft("");
      window.setTimeout(scrollToBottom, 50);
    } finally {
      setBusy(false);
    }
  }, [conv?.id, draft]);

  const startEdit = (m: Msg) => {
    setOpenMenuId(null);
    setEditingId(m.id);
    setEditText(m.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
    setOpenMenuId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const target = rows.find((r) => r.id === editingId);
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

  const clearConversation = async () => {
    if (!conv?.id) return;
    if (
      !window.confirm(
        "Clear this conversation for you only? The admin will still keep their copy.",
      )
    ) {
      return;
    }
    setErr(null);
    const { error } = await supabase.from("support_conversations").update({ owner_cleared_at: new Date().toISOString() }).eq("id", conv.id);
    if (error) {
      setErr(error.message);
      return;
    }
    setRows([]);
    setEditingId(null);
    setEditText("");
  };

  return (
    <div className="page page--wide support-page">
      {conv?.id ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button type="button" className="btn btn-outline support-page__danger" onClick={() => void clearConversation()}>
            Clear conversation
          </button>
        </div>
      ) : null}

      {err ? <div className="alert-banner alert-banner--error">{err}</div> : null}

      <div className="card support-card">
        <div className="support-card__feed" role="log" aria-label="Support messages">
          {rows.length === 0 ? (
            <div className="support-empty">
              <strong>Start a conversation</strong>
              <p>Send a message and our admin team will reply.</p>
            </div>
          ) : (
            rows.map((m) => {
              const mine = meId && m.sender_id === meId;
              const canEdit = mine && supportMessageWithinEditWindow(m.created_at);
              const canDelete = mine;
              const isEditing = editingId === m.id;
              const showMenu = !isEditing && (canEdit || canDelete);
              return (
                <div key={m.id} className={["support-msg", mine ? "support-msg--mine" : ""].filter(Boolean).join(" ")}>
                  <div className={["support-msg__inner", mine ? "support-msg__inner--mine" : ""].filter(Boolean).join(" ")}>
                    {showMenu ? (
                      <div className="support-msg__menu-col" data-support-msg-menu>
                        <button
                          type="button"
                          className="support-msg__menu-btn"
                          aria-label="Message options"
                          aria-expanded={openMenuId === m.id}
                          aria-haspopup="true"
                          onClick={() => setOpenMenuId((cur) => (cur === m.id ? null : m.id))}
                        >
                          <span className="support-msg__menu-dots" aria-hidden>
                            ⋮
                          </span>
                        </button>
                        {openMenuId === m.id ? (
                          <div className="support-msg__menu" role="menu">
                            {canEdit ? (
                              <button
                                type="button"
                                role="menuitem"
                                className="support-msg__menu-item"
                                onClick={() => startEdit(m)}
                              >
                                Edit
                              </button>
                            ) : null}
                            {canDelete ? (
                              <button
                                type="button"
                                role="menuitem"
                                className="support-msg__menu-item support-msg__menu-item--danger"
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
                    <div className="support-msg__bubble">
                      {isEditing ? (
                        <div className="support-msg__edit">
                          <textarea
                            className="support-input support-msg__edit-input"
                            rows={3}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                          />
                          <div className="support-msg__edit-actions">
                            <button type="button" className="btn btn-primary btn-inline" onClick={() => void saveEdit()}>
                              Save
                            </button>
                            <button type="button" className="btn btn-outline btn-inline" onClick={cancelEdit}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="support-msg__text">{m.body}</div>
                      )}
                      <div className="support-msg__meta">
                        {new Date(m.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {m.edited_at ? <span className="support-msg__edited"> · Edited</span> : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="support-card__composer">
          <textarea
            className="support-input"
            rows={3}
            placeholder="Type your message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="support-actions">
            <div className="support-hint">Tip: Ctrl/⌘ + Enter to send</div>
            <button type="button" className="btn btn-primary" disabled={!canSend} onClick={() => void send()}>
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
