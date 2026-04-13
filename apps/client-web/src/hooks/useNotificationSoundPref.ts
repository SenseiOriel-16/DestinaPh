import { useSyncExternalStore } from "react";
import {
  getNotificationSoundEnabled,
  NOTIFICATION_SOUND_CHANGE_EVENT,
} from "../lib/notificationSound";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(NOTIFICATION_SOUND_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(NOTIFICATION_SOUND_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useNotificationSoundPref() {
  const enabled = useSyncExternalStore(subscribe, getNotificationSoundEnabled, () => false);
  return { enabled };
}
