import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Conversation = {
  id: string;
  owner_id: string;
};

type Msg = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "business_owner" | "admin";
  body: string;
  created_at: string;
};

export function SupportPage() {
  const [conv, setConv] = useState<Conversation | null>(null);
  const [rows, setRows] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
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

    // Don't use upsert here: if a conversation already exists, Supabase may perform an UPDATE,
    // and our RLS intentionally limits updates to admins (owners shouldn't edit conversations).
    const { data: existing, error: selErr } = await supabase
      .from("support_conversations")
      .select("id,owner_id")
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
      .select("id,owner_id")
      .maybeSingle();

    if (insErr) {
      // If another tab already created it (unique owner_id), just re-select.
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
      .select("id,conversation_id,sender_id,sender_role,body,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) {
      setErr(error.message);
      return;
    }
    setRows((data as Msg[]) ?? []);
    window.setTimeout(scrollToBottom, 50);
  }, []);

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
          setRows((prev) => [...prev, row]);
          window.setTimeout(scrollToBottom, 30);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conv?.id]);

  useEffect(() => {
    // Mark admin replies as read by owner when user is on this page.
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
      const { error } = await supabase.from("support_messages").insert({
        conversation_id: conv.id,
        sender_id: uid,
        sender_role: "business_owner",
        body,
        is_read_by_owner: true,
        is_read_by_admin: false,
      });
      if (error) {
        setErr(error.message);
        return;
      }
      setDraft("");
      window.setTimeout(scrollToBottom, 50);
    } finally {
      setBusy(false);
    }
  }, [conv?.id, draft]);

  return (
    <div className="page page--wide support-page">
      <header className="owner-reservations__hero" style={{ marginBottom: 18 }}>
        <div className="owner-reservations__hero-text">
          <p className="owner-reservations__eyebrow">Support</p>
          <h1 className="owner-reservations__title">Contact support</h1>
          <p className="owner-reservations__lead">
            Message the DestinaPH admin team. You&apos;ll get a reply here.
          </p>
        </div>
        <div className="owner-reservations__hero-art" aria-hidden />
      </header>

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
              return (
                <div key={m.id} className={["support-msg", mine ? "support-msg--mine" : ""].filter(Boolean).join(" ")}>
                  <div className="support-msg__bubble">
                    <div className="support-msg__text">{m.body}</div>
                    <div className="support-msg__meta">
                      {new Date(m.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
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

