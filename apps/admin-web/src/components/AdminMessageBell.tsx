import { useNavigate } from "react-router-dom";
import { useAdminSupportMessages } from "../hooks/useAdminSupportMessages";

export function AdminMessageBell() {
  const navigate = useNavigate();
  const { items, unreadCount, open, setOpen, wrapRef, markConversationRead, clearList } = useAdminSupportMessages();

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className={["admin-topbar__bell", unreadCount > 0 ? "admin-topbar__bell--active" : ""].filter(Boolean).join(" ")}
        aria-label="Messages"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        title="Support messages"
      >
        <span className="admin-topbar__bell-inner" aria-hidden>
          {"\u2709\uFE0F"}
        </span>
        {unreadCount > 0 ? <span className="admin-topbar__badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
      </button>

      {open ? (
        <div className="notif-dropdown" role="menu">
          <div className="notif-dropdown__head">
            <div className="notif-dropdown__head-text">
              <span className="notif-dropdown__head-label">Messages</span>
              <span className="notif-dropdown__head-sub">Support inbox updates</span>
            </div>
            {unreadCount > 0 ? <span className="notif-dropdown__head-count">{unreadCount}</span> : null}
          </div>

          {items.length === 0 ? (
            <div className="notif-dropdown__empty-wrap">
              <span className="notif-dropdown__empty-icon" aria-hidden>
                {"\u{1F4EC}"}
              </span>
              <p className="notif-dropdown__empty">No messages yet.</p>
            </div>
          ) : (
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
                        void markConversationRead(m.conversation_id);
                        navigate("/support");
                        setOpen(false);
                      }}
                    >
                      <span className="notif-dropdown__icon" aria-hidden>
                        {"\u{1F4AC}"}
                      </span>
                      <div className="notif-dropdown__item-main">
                        <span className="notif-dropdown__kind">Support</span>
                        <strong className="notif-dropdown__title">
                          {m.is_read_by_admin ? "Message" : "New message"}
                        </strong>
                        <span className="notif-dropdown__sub">{preview.length > 90 ? `${preview.slice(0, 90)}…` : preview || "Open inbox to read"}</span>
                        <time className="notif-dropdown__time" dateTime={m.created_at}>
                          {new Date(m.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      <span className="notif-dropdown__chevron" aria-hidden>
                        {"\u203A"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="notif-dropdown__foot">
            <button type="button" className="notif-dropdown__sound-btn" onClick={() => clearList()}>
              <span className="notif-dropdown__sound-icon" aria-hidden>
                {"\u2715"}
              </span>
              <span>Clear list (local)</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

