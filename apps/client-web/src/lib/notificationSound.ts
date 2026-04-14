import soundUrl from "../../../Notification.wav";

const STORAGE_KEY = "destinaph_notification_sound";

export const NOTIFICATION_SOUND_CHANGE_EVENT = "destinaph-notification-sound-change";
export const NOTIFICATION_SOUND_BLOCKED_EVENT = "destinaph-notification-sound-blocked";

let blocked = false;

export function getNotificationSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function isNotificationSoundBlocked(): boolean {
  return blocked;
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new Event(NOTIFICATION_SOUND_CHANGE_EVENT));
}

export async function tryEnableNotificationSound(): Promise<boolean> {
  const a = new Audio(soundUrl);
  a.volume = 0.01;
  try {
    await a.play();
    a.pause();
    a.currentTime = 0;
    blocked = false;
    window.dispatchEvent(new Event(NOTIFICATION_SOUND_BLOCKED_EVENT));
    setNotificationSoundEnabled(true);
    return true;
  } catch {
    return false;
  }
}

export function unlockNotificationAudio(): void {
  void tryEnableNotificationSound();
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

export function playNotificationSound(): void {
  if (!getNotificationSoundEnabled()) return;
  const a = new Audio(soundUrl);
  a.volume = 0.85;
  void a.play().catch(() => {
    blocked = true;
    window.dispatchEvent(new Event(NOTIFICATION_SOUND_BLOCKED_EVENT));
  });
}
