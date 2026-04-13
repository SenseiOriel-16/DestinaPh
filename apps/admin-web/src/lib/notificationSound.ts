import soundUrl from "../../../Notification.wav";

const STORAGE_KEY = "destinaph_notification_sound";

/** Same-tab + cross-tab updates for sound preference. */
export const NOTIFICATION_SOUND_CHANGE_EVENT = "destinaph-notification-sound-change";

/** Explicit "0" = user muted. Missing key = on (first visit). */
export function getNotificationSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) !== "0";
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new Event(NOTIFICATION_SOUND_CHANGE_EVENT));
}

/**
 * User gesture: unlock browser audio + turn sound on (used by "Tap to enable" UI).
 */
export async function tryEnableNotificationSound(): Promise<boolean> {
  const a = new Audio(soundUrl);
  a.volume = 0.01;
  try {
    await a.play();
    a.pause();
    a.currentTime = 0;
    setNotificationSoundEnabled(true);
    return true;
  } catch {
    return false;
  }
}

/** After any click/tap in the app while sound is allowed, warm the audio session (no pref change). */
export async function primeNotificationAudioFromUserGesture(): Promise<void> {
  if (!getNotificationSoundEnabled()) return;
  const a = new Audio(soundUrl);
  a.volume = 0.01;
  try {
    await a.play();
    a.pause();
    a.currentTime = 0;
  } catch {
    /* autoplay may still block until a louder play succeeds */
  }
}

/** @deprecated Prefer {@link tryEnableNotificationSound} or {@link primeNotificationAudioFromUserGesture}. */
export function unlockNotificationAudio(): void {
  void tryEnableNotificationSound();
}

export function playNotificationSound(): void {
  if (!getNotificationSoundEnabled()) return;
  const a = new Audio(soundUrl);
  a.volume = 0.85;
  void a.play().catch(() => {
    /* autoplay policy — next attempt may work after user gesture */
  });
}
