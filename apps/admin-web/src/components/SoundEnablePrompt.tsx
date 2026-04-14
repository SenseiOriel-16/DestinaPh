import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";
import {
  isNotificationSoundBlocked,
  NOTIFICATION_SOUND_BLOCKED_EVENT,
  tryEnableNotificationSound,
} from "../lib/notificationSound";
import { useNotificationSoundPref } from "../hooks/useNotificationSoundPref";

export function SoundEnablePrompt() {
  const { enabled } = useNotificationSoundPref();
  const [busy, setBusy] = useState(false);
  const [showErr, setShowErr] = useState(false);
  const [blocked, setBlocked] = useState(() => isNotificationSoundBlocked());

  useEffect(() => {
    const onBlocked = () => setBlocked(isNotificationSoundBlocked());
    window.addEventListener(NOTIFICATION_SOUND_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(NOTIFICATION_SOUND_BLOCKED_EVENT, onBlocked);
  }, []);

  const onEnable = useCallback(async () => {
    setBusy(true);
    setShowErr(false);
    const ok = await tryEnableNotificationSound();
    setBusy(false);
    if (!ok) setShowErr(true);
  }, []);

  // Always show when user turned it off OR when browser blocked autoplay for audio.
  if (enabled && !blocked) return null;

  return createPortal(
    <div className="sound-enable-prompt" role="dialog" aria-labelledby="sound-enable-title">
      <p id="sound-enable-title" className="sound-enable-prompt__title">
        {enabled ? "Notification sound needs a tap" : "Notification sound is off"}
      </p>
      <p className="sound-enable-prompt__text">
        {enabled
          ? "Your browser blocked autoplay. Tap below once so alerts can play sound."
          : "Tap below so new owner registrations and alerts can play a sound."}
      </p>
      <button type="button" className="sound-enable-prompt__btn" onClick={() => void onEnable()} disabled={busy}>
        {busy ? "Enabling…" : "Tap to turn on notification sound"}
      </button>
      {showErr ? (
        <p className="sound-enable-prompt__err">Audio could not start. Try again or check your browser settings.</p>
      ) : null}
    </div>,
    document.body,
  );
}
