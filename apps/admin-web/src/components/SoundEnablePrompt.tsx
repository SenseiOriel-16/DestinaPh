import { createPortal } from "react-dom";
import { useCallback, useState } from "react";
import { tryEnableNotificationSound } from "../lib/notificationSound";
import { useNotificationSoundPref } from "../hooks/useNotificationSoundPref";

export function SoundEnablePrompt() {
  const { enabled } = useNotificationSoundPref();
  const [busy, setBusy] = useState(false);
  const [showErr, setShowErr] = useState(false);

  const onEnable = useCallback(async () => {
    setBusy(true);
    setShowErr(false);
    const ok = await tryEnableNotificationSound();
    setBusy(false);
    if (!ok) setShowErr(true);
  }, []);

  if (enabled) return null;

  return createPortal(
    <div className="sound-enable-prompt" role="dialog" aria-labelledby="sound-enable-title">
      <p id="sound-enable-title" className="sound-enable-prompt__title">
        Notification sound is off
      </p>
      <p className="sound-enable-prompt__text">
        Tap below so new registrations, premium requests, and alerts can play a sound.
      </p>
      <button type="button" className="sound-enable-prompt__btn" onClick={() => void onEnable()} disabled={busy}>
        {busy ? "Enabling…" : "Tap to enable sound"}
      </button>
      {showErr ? (
        <p className="sound-enable-prompt__err">Audio could not start. Try again or check your browser settings.</p>
      ) : null}
    </div>,
    document.body,
  );
}
