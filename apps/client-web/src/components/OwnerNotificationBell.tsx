import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useOwnerNotifications } from "../hooks/useOwnerNotifications";
import { useNotificationSoundPref } from "../hooks/useNotificationSoundPref";
import { setNotificationSoundEnabled } from "../lib/notificationSound";

export function OwnerNotificationBell() {
  const navigate = useNavigate();
  const { enabled: soundOn } = useNotificationSoundPref();
  const { items, totalBadge, open, setOpen, toasts, dismissToast, wrapRef, clearItems } = useOwnerNotifications();

  const toastLayer =
    toasts.length > 0 ? (
      <div className="notif-toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="notif-toast">
            <button
              type="button"
              className="notif-toast__main"
              onClick={() => {
                dismissToast(t.id);
                navigate(t.href);
              }}
            >
              <strong>{t.title}</strong>
              <span>{t.body}</span>
            </button>
            <button type="button" className="notif-toast__close" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
              ×
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
          className="owner-topbar__bell"
          aria-label="Notifications"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span aria-hidden>{String.fromCodePoint(0x1f514)}</span>
          {totalBadge > 0 ? (
            <span className="owner-topbar__badge owner-topbar__badge--green">
              {totalBadge > 99 ? "99+" : totalBadge}
            </span>
          ) : null}
        </button>
        {open ? (
          <div className="notif-dropdown" role="menu">
            <div className="notif-dropdown__head">Notifications</div>
            {items.length === 0 ? (
              <p className="notif-dropdown__empty">
                You&apos;re all caught up. We&apos;ll notify you when premium is enabled or travelers rate your listings.
              </p>

            ) : (
              <>
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
                        <strong>{it.title}</strong>
                        <span className="notif-dropdown__sub">{it.subtitle}</span>
                        <time className="notif-dropdown__time">{new Date(it.createdAt).toLocaleString()}</time>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="notif-dropdown__clear"
                  onClick={() => {
                    clearItems();
                    setOpen(false);
                  }}
                >
                  Clear list
                </button>
              </>
            )}
            <div className="notif-dropdown__foot">
              {soundOn ? (
                <button
                  type="button"
                  className="notif-dropdown__mute"
                  onClick={() => setNotificationSoundEnabled(false)}
                >
                  Turn off notification sound
                </button>
              ) : (
                <p className="notif-dropdown__hint">Sound is off. Use the card at the top-right to enable.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {toastLayer ? createPortal(toastLayer, document.body) : null}
    </>
  );
}
