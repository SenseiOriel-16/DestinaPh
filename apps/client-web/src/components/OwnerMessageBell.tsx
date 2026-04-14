import { useNavigate } from "react-router-dom";
import { useOwnerSupportMessages } from "../hooks/useOwnerSupportMessages";

export function OwnerMessageBell() {
  const navigate = useNavigate();
  const { items, unreadCount, open, setOpen, wrapRef, markAllRead, clearList } = useOwnerSupportMessages();

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className="owner-topbar__bell"
        aria-label="Messages"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        title="Support messages"
      >
        <span aria-hidden>{"\u2709\uFE0F"}</span>
        {unreadCount > 0 ? (
          <span className="owner-topbar__badge owner-topbar__badge--green">{unreadCount > 99 ? "99+" : unreadCount}</span>
        ) : null}
      </button>

      {open ? (
        <div className="notif-dropdown" role="menu">
          <div className="notif-dropdown__head">Messages</div>

          {items.length === 0 ? (
            <p className="notif-dropdown__empty">No messages yet. Admin replies will show here.</p>
          ) : (
            <>
              <ul className="notif-dropdown__list">
                {items.map((m) => {
                  const preview = String(m.body ?? "").trim();
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="notif-dropdown__item"
                        role="menuitem"
                        onClick={() => {
                          void markAllRead();
                          navigate("/support");
                          setOpen(false);
                        }}
                      >
                        <strong>{m.is_read_by_owner ? "Message" : "New message"}</strong>
                        <span className="notif-dropdown__sub">
                          {preview.length > 100 ? `${preview.slice(0, 100)}…` : preview || "Open support to read"}
                        </span>
                        <time className="notif-dropdown__time">{new Date(m.created_at).toLocaleString()}</time>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="notif-dropdown__clear"
                onClick={() => {
                  clearList();
                  setOpen(false);
                }}
              >
                Clear list (local)
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

