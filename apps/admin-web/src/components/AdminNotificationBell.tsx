import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAdminNotifications } from "../hooks/useAdminNotifications";
import { useNotificationSoundPref } from "../hooks/useNotificationSoundPref";
import { setNotificationSoundEnabled } from "../lib/notificationSound";

function DropdownIcon() {
  return (
    <span className="notif-dropdown__icon notif-dropdown__icon--approval" aria-hidden>
      {"\u{1F465}"}
    </span>
  );
}

function ToastIcon() {
  return (
    <span className="notif-toast__icon notif-toast__icon--approval" aria-hidden>
      {"\u{1F465}"}
    </span>
  );
}

export function AdminNotificationBell() {
  const navigate = useNavigate();
  const { enabled: soundOn } = useNotificationSoundPref();
  const { items, totalBadge, open, setOpen, toasts, dismissToast, wrapRef } = useAdminNotifications();

  const toastLayer =
    toasts.length > 0 ? (
      <div className="notif-toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="notif-toast">
            <ToastIcon />
            <button
              type="button"
              className="notif-toast__main"
              onClick={() => {
                dismissToast(t.id);
                navigate(t.href);
              }}
            >
              <span className="notif-toast__eyebrow">Registration</span>
              <strong>{t.title}</strong>
              <span className="notif-toast__body">{t.body}</span>
            </button>
            <button type="button" className="notif-toast__close" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
              <span aria-hidden>{"\u2715"}</span>
            </button>
          </div>
        ))}
      </div>
    ) : null;

  return (
    <>
      <div className="notif-bell-wrap" ref={wrapRef}>
        <button
          type="button"
          className={["admin-topbar__bell", totalBadge > 0 ? "admin-topbar__bell--active" : ""].filter(Boolean).join(" ")}
          aria-label="Notifications"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="admin-topbar__bell-inner" aria-hidden>
            {String.fromCodePoint(0x1f514)}
          </span>
          {totalBadge > 0 ? (
            <span className="admin-topbar__badge">{totalBadge > 99 ? "99+" : totalBadge}</span>
          ) : null}
        </button>
        {open ? (
          <div className="notif-dropdown" role="menu">
            <div className="notif-dropdown__head">
              <div className="notif-dropdown__head-text">
                <span className="notif-dropdown__head-label">Notifications</span>
                <span className="notif-dropdown__head-sub">Pending items need your attention</span>
              </div>
              {totalBadge > 0 ? (
                <span className="notif-dropdown__head-count">{totalBadge}</span>
              ) : null}
            </div>
            {items.length === 0 ? (
              <div className="notif-dropdown__empty-wrap">
                <span className="notif-dropdown__empty-icon" aria-hidden>
                  {"\u{1F4C5}"}
                </span>
                <p className="notif-dropdown__empty">You&apos;re all caught up. No pending owner registrations.</p>
              </div>
            ) : (
              <ul className="notif-dropdown__list">
                {items.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      className="notif-dropdown__item"
                      role="menuitem"
                      onClick={() => {
                        navigate(it.href);
                        setOpen(false);
                      }}
                    >
                      <DropdownIcon />
                      <div className="notif-dropdown__item-main">
                        <span className="notif-dropdown__kind">Owner signup</span>
                        <strong className="notif-dropdown__title">{it.title}</strong>
                        <span className="notif-dropdown__sub">{it.subtitle}</span>
                        <time className="notif-dropdown__time" dateTime={it.createdAt}>
                          {new Date(it.createdAt).toLocaleString(undefined, {
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
                ))}
              </ul>
            )}
            <div className="notif-dropdown__foot">
              {soundOn ? (
                <button
                  type="button"
                  className="notif-dropdown__sound-btn"
                  onClick={() => setNotificationSoundEnabled(false)}
                >
                  <span className="notif-dropdown__sound-icon" aria-hidden>
                    {"\u{1F507}"}
                  </span>
                  <span>Mute notification sound</span>
                </button>
              ) : (
                <p className="notif-dropdown__hint">
                  <span className="notif-dropdown__hint-icon" aria-hidden>
                    {"\u{1F508}"}
                  </span>
                  Sound is off — use the card at the top-right of the screen to enable.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {toastLayer ? createPortal(toastLayer, document.body) : null}
    </>
  );
}
