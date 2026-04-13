import soundUrl from "../../../Notification.wav";

const STORAGE_KEY = "destinaph_notification_sound";

export const NOTIFICATION_SOUND_CHANGE_EVENT = "destinaph-notification-sound-change";

let unlocked = false;

export function getNotificationSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
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
    unlocked = true;
    setNotificationSoundEnabled(true);
    return true;
  } catch {
    return false;
  }
}

export function unlockNotificationAudio(): void {
  void tryEnableNotificationSound();
}

export function playNotificationSound(): void {
  if (!getNotificationSoundEnabled() || !unlocked) return;
  const a = new Audio(soundUrl);
  a.volume = 0.85;
  void a.play().catch(() => {});
}
